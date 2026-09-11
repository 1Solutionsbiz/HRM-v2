import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthContext } from '../common/auth-context.js';
import {
  extractTemplateTokens,
  formatLongDate,
  LETTER_TYPE_CUSTOM_VARIABLES,
  renderTemplate,
  resolveFixedVariables,
  validateCustomVariables,
  validateRequiredCustomVariables,
  validateTemplateTokens,
} from './template-variables.js';
import { generateLetterPdfBuffer } from './letter-pdf.js';
import { letterFilePath, saveLetterPdf } from './letter-file-storage.js';
import type { GenerateLetterDto } from './dto/generate-letter.dto.js';
import type { CancelLetterDto } from './dto/cancel-letter.dto.js';
import type { SearchEmployeesQueryDto } from './dto/search-employees-query.dto.js';

@Injectable()
export class LettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------
  // Scope resolution — mirrors DailyReportsService.resolveTeamScope. Only
  // hr/admin are granted letters:* in the seed data today (see
  // seed-letters.ts), so this always resolves to 'ALL' in practice; kept
  // scope-aware rather than hardcoded so a future manager grant (like
  // leave:approve today) doesn't silently bypass per-employee scoping.
  // ---------------------------------------------------------------------

  private async resolveEmployeeScope(actor: AuthContext): Promise<'ALL' | string[]> {
    if (actor.roles.includes('hr') || actor.roles.includes('admin')) return 'ALL';
    const manager = await this.prisma.employee.findUnique({ where: { userId: actor.userId } });
    if (!manager) return [];
    const reports = await this.prisma.employee.findMany({
      where: { managerId: manager.id },
      select: { id: true },
    });
    return reports.map((r) => r.id);
  }

  private async assertCanAccessEmployee(actor: AuthContext, employeeId: string): Promise<void> {
    const scope = await this.resolveEmployeeScope(actor);
    if (scope === 'ALL') return;
    if (!scope.includes(employeeId)) {
      throw new ForbiddenException('You are not authorised to generate letters for this employee');
    }
  }

  // ---------------------------------------------------------------------
  // Employee lookup — deliberately NOT a reuse of GET /employees (that
  // route requires employee:manage; a letters:generate holder without it
  // would 403). Narrow select, matching EmployeesService.findAll's
  // reasoning: no bulk PII (personalEmail/dateOfBirth/address) beyond what
  // a "pick who this letter is for" UI needs.
  // ---------------------------------------------------------------------

  async searchEmployees(actor: AuthContext, query: SearchEmployeesQueryDto) {
    const scope = await this.resolveEmployeeScope(actor);
    if (scope !== 'ALL' && scope.length === 0) return [];

    const term = query.q?.trim();
    let matchingIds: string[] | undefined;
    if (term) {
      matchingIds = await this.findEmployeeIdsMatchingTerm(term);
      if (matchingIds.length === 0) return [];
    }

    return this.prisma.employee.findMany({
      where: {
        ...(scope === 'ALL' ? {} : { id: { in: scope } }),
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
      take: 25,
      orderBy: { firstName: 'asc' },
    });
  }

  /**
   * `@prisma/adapter-mariadb` binds string parameters with a collation
   * that conflicts with this table's `utf8mb4_unicode_ci` columns for LIKE
   * specifically - MariaDB error 1267, "Illegal mix of collations
   * (utf8mb4_unicode_ci,IMPLICIT) and (utf8mb4_bin,NONE) for operation
   * 'like'". Confirmed empirically against production: Prisma's `contains`
   * filter hit this (it compiles to the same parameterized LIKE), and so
   * did a plain `$queryRaw` tagged template - it's the driver's parameter
   * binding, not Prisma's query builder specifically. An explicit
   * `COLLATE utf8mb4_unicode_ci` on the bound parameter works around it,
   * confirmed against production too. Kept to just this id lookup so the
   * rest of searchEmployees (joins, select, scope, ordering) stays on the
   * type-safe Prisma query builder.
   */
  private async findEmployeeIdsMatchingTerm(term: string): Promise<string[]> {
    // Escape LIKE wildcards in the user's own input so e.g. searching "50%"
    // matches the literal characters, not an unintended wildcard.
    const escaped = term.replace(/[%_\\]/g, (c) => `\\${c}`);
    const like = `%${escaped}%`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM employees
      WHERE firstName LIKE ${like} COLLATE utf8mb4_unicode_ci
         OR lastName LIKE ${like} COLLATE utf8mb4_unicode_ci
         OR employeeCode LIKE ${like} COLLATE utf8mb4_unicode_ci
    `;
    return rows.map((r) => r.id);
  }

  // ---------------------------------------------------------------------
  // Categories / types / templates — read-only in P1 (no template editor).
  // ---------------------------------------------------------------------

  /**
   * customVariableKeys is read off the code-owned whitelist
   * (LETTER_TYPE_CUSTOM_VARIABLES), not stored on the row - it's how the
   * minimal generate-letter UI knows which custom fields to render for a
   * given type without duplicating that list on the frontend.
   */
  async listCategories() {
    const categories = await this.prisma.letterCategory.findMany({
      include: { types: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => ({
      ...category,
      types: category.types.map((type) => {
        const spec = LETTER_TYPE_CUSTOM_VARIABLES[type.key] ?? { required: [], optional: [] };
        return { ...type, customVariables: spec };
      }),
    }));
  }

  private async getActiveTemplate(letterTypeId: string, templateId?: string) {
    const template = templateId
      ? await this.prisma.letterTemplate.findUnique({ where: { id: templateId } })
      : await this.prisma.letterTemplate.findFirst({
          where: { letterTypeId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });
    if (!template || template.letterTypeId !== letterTypeId || !template.isActive) {
      throw new NotFoundException('No active template is configured for this letter type');
    }
    const version = await this.prisma.letterTemplateVersion.findUnique({
      where: {
        templateId_versionNumber: {
          templateId: template.id,
          versionNumber: template.currentVersionNumber,
        },
      },
    });
    if (!version) {
      throw new NotFoundException('This letter template has no current version');
    }
    return { template, version };
  }

  // ---------------------------------------------------------------------
  // Rendering — shared by preview() and generate(). Does not touch the
  // database or allocate a document number; the caller decides whether
  // this is a throwaway preview or a real, numbered generation.
  // ---------------------------------------------------------------------

  private async renderForEmployee(params: {
    employeeId: string;
    letterTypeId: string;
    templateId?: string;
    customVariables: Record<string, string>;
    documentNumber: string;
    generatedAt: Date;
  }) {
    const [employee, letterType, companySettings] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: params.employeeId },
        include: {
          department: true,
          designation: true,
          user: { select: { email: true } },
          manager: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.letterType.findUnique({ where: { id: params.letterTypeId } }),
      this.prisma.companySettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!letterType || !letterType.isActive) throw new NotFoundException('Letter type not found');

    const { template, version } = await this.getActiveTemplate(params.letterTypeId, params.templateId);
    const signatory = template.signatoryId
      ? await this.prisma.letterSignatory.findUnique({ where: { id: template.signatoryId } })
      : await this.prisma.letterSignatory.findFirst({ where: { isDefault: true, isActive: true } });
    if (!signatory) {
      throw new NotFoundException('No signatory is configured for this letter template');
    }

    validateCustomVariables(letterType.key, params.customVariables);
    validateRequiredCustomVariables(letterType.key, params.customVariables);
    validateTemplateTokens(version.content, letterType.key);

    const fixed = resolveFixedVariables({
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeCode: employee.employeeCode,
        email: employee.user.email,
        department: employee.department?.name ?? null,
        designation: employee.designation?.title ?? null,
        dateOfJoining: employee.dateOfJoining,
        employmentType: employee.employmentType,
        workLocation: employee.workLocation,
        address: employee.currentAddress ?? employee.permanentAddress ?? null,
        reportingManager: employee.manager
          ? `${employee.manager.firstName} ${employee.manager.lastName}`
          : null,
      },
      company: {
        legalName: companySettings.legalName,
        brandName: companySettings.brandName,
        address: companySettings.address,
        website: companySettings.website,
        supportEmail: companySettings.supportEmail,
        phone: companySettings.phone,
      },
      documentNumber: params.documentNumber,
      generatedAt: params.generatedAt,
      signatory: { name: signatory.name, title: signatory.title },
    });
    const resolved: Record<string, string> = { ...fixed };
    for (const key of extractTemplateTokens(version.content)) {
      if (key.startsWith('custom.')) {
        resolved[key] = params.customVariables[key.slice('custom.'.length)] ?? '';
      }
    }

    const renderedContent = renderTemplate(version.content, resolved);
    return {
      employee,
      letterType,
      template,
      version,
      companySettings,
      signatory,
      resolvedVariables: resolved,
      renderedContent,
    };
  }

  async preview(actor: AuthContext, dto: GenerateLetterDto) {
    await this.assertCanAccessEmployee(actor, dto.employeeId);
    const now = new Date();
    const result = await this.renderForEmployee({
      employeeId: dto.employeeId,
      letterTypeId: dto.letterTypeId,
      templateId: dto.templateId,
      customVariables: dto.customVariables ?? {},
      // Not a real allocation — previews never burn a sequence number.
      documentNumber: '(assigned on generation)',
      generatedAt: now,
    });
    return {
      letterTypeName: result.letterType.name,
      paragraphs: result.renderedContent.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      signatoryName: result.signatory.name,
      signatoryTitle: result.signatory.title,
      dateLabel: formatLongDate(now),
    };
  }

  async generate(actor: AuthContext, dto: GenerateLetterDto) {
    await this.assertCanAccessEmployee(actor, dto.employeeId);

    const letterType = await this.prisma.letterType.findUnique({ where: { id: dto.letterTypeId } });
    if (!letterType || !letterType.isActive) throw new NotFoundException('Letter type not found');

    const now = new Date();
    const year = now.getUTCFullYear();
    const sequenceKey = `letter:${letterType.numberPrefix}:${year}`;
    const sequenceValue = await this.sequenceService.nextOrCreate(sequenceKey);
    const documentNumber = `${letterType.numberPrefix}/${year}/${String(sequenceValue).padStart(4, '0')}`;

    const result = await this.renderForEmployee({
      employeeId: dto.employeeId,
      letterTypeId: dto.letterTypeId,
      templateId: dto.templateId,
      customVariables: dto.customVariables ?? {},
      documentNumber,
      generatedAt: now,
    });

    const paragraphs = result.renderedContent.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const pdfBuffer = await generateLetterPdfBuffer({
      companyName: result.companySettings.legalName,
      letterTitle: result.letterType.name,
      documentNumber,
      dateLabel: formatLongDate(now),
      paragraphs,
      signatoryName: result.signatory.name,
      signatoryTitle: result.signatory.title,
      companyWebsite: result.companySettings.website,
      companyPhone: result.companySettings.phone,
      companySupportEmail: result.companySettings.supportEmail,
    });
    const filename = await saveLetterPdf(pdfBuffer);

    const created = await this.prisma.employeeLetter.create({
      data: {
        employeeId: dto.employeeId,
        letterTypeId: dto.letterTypeId,
        templateId: result.template.id,
        templateVersionId: result.version.id,
        documentNumber,
        resolvedVariables: result.resolvedVariables,
        renderedContent: result.renderedContent,
        fileUrl: filename,
        generatedByUserId: actor.userId,
      },
    });

    await this.notificationsService.createForEmployee(dto.employeeId, {
      type: 'LETTER',
      title: `${letterType.name} generated`,
      description: `Your ${letterType.name.toLowerCase()} (${documentNumber}) is ready.`,
      linkUrl: '/letters',
    });
    await this.auditService.log({
      eventType: 'LETTER_GENERATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'EmployeeLetter',
      targetId: created.id,
      description: `Generated ${letterType.name} ${documentNumber} for employee ${dto.employeeId}`,
    });

    return {
      id: created.id,
      documentNumber: created.documentNumber,
      status: created.status,
      generatedAt: created.generatedAt,
      employeeId: created.employeeId,
    };
  }

  /**
   * List rows never include resolvedVariables/renderedContent/fileUrl - the
   * first two are large per-row JSON/text blobs nothing in the minimal P1
   * list view needs, and fileUrl is the internal storage filename, not
   * something a client should see (downloads go through getDownload(),
   * which resolves it server-side).
   */
  async list(actor: AuthContext, employeeId?: string) {
    const scope = await this.resolveEmployeeScope(actor);
    if (scope !== 'ALL' && scope.length === 0) return [];
    if (employeeId) await this.assertCanAccessEmployee(actor, employeeId);

    const letters = await this.prisma.employeeLetter.findMany({
      where: {
        ...(scope === 'ALL' ? {} : { employeeId: { in: scope } }),
        ...(employeeId ? { employeeId } : {}),
      },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        generatedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        letterType: { select: { name: true } },
      },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
    return letters;
  }

  async getDownload(actor: AuthContext, letterId: string) {
    const letter = await this.prisma.employeeLetter.findUnique({ where: { id: letterId } });
    if (!letter) throw new NotFoundException('Letter not found');
    await this.assertCanAccessEmployee(actor, letter.employeeId);
    return { filePath: letterFilePath(letter.fileUrl), documentNumber: letter.documentNumber };
  }

  async cancel(actor: AuthContext, letterId: string, dto: CancelLetterDto) {
    const letter = await this.prisma.employeeLetter.findUnique({ where: { id: letterId } });
    if (!letter) throw new NotFoundException('Letter not found');
    await this.assertCanAccessEmployee(actor, letter.employeeId);
    if (letter.status !== 'GENERATED') {
      throw new ConflictException('Only a generated letter can be cancelled');
    }

    const updated = await this.prisma.employeeLetter.update({
      where: { id: letterId },
      data: {
        status: 'CANCELLED',
        cancelledByUserId: actor.userId,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
    });

    await this.auditService.log({
      eventType: 'LETTER_CANCELLED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'EmployeeLetter',
      targetId: letterId,
      description: `Cancelled letter ${letter.documentNumber}: ${dto.reason}`,
    });

    return {
      id: updated.id,
      documentNumber: updated.documentNumber,
      status: updated.status,
      cancelledAt: updated.cancelledAt,
      cancellationReason: updated.cancellationReason,
      employeeId: updated.employeeId,
    };
  }
}
