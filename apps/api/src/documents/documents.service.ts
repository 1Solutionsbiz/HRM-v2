import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { SubmitDocumentDto } from './dto/submit-document.dto.js';
import type { VerifyDocumentDto } from './dto/verify-document.dto.js';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getDocumentTypes() {
    return this.prisma.documentType.findMany({ orderBy: { name: 'asc' } });
  }

  async getMyDocuments(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.getChecklist(employeeId);
  }

  async getEmployeeDocuments(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.getChecklist(employeeId);
  }

  async submitDocument(
    userId: string,
    documentTypeId: string,
    dto: SubmitDocumentDto,
    actor: AuthContext,
  ) {
    const employeeId = await this.requireEmployeeId(userId);
    const documentType = await this.prisma.documentType.findUnique({
      where: { id: documentTypeId },
    });
    if (!documentType) throw new NotFoundException('Document type not found');

    // A resubmission clears any prior review outcome — a new file means the
    // previous verification/rejection no longer applies to what's on file.
    const record = await this.prisma.employeeDocument.upsert({
      where: { employeeId_documentTypeId: { employeeId, documentTypeId } },
      create: {
        employeeId,
        documentTypeId,
        fileUrl: dto.fileUrl,
        status: 'PENDING_REVIEW',
        uploadedAt: new Date(),
      },
      update: {
        fileUrl: dto.fileUrl,
        status: 'PENDING_REVIEW',
        uploadedAt: new Date(),
        verifiedByUserId: null,
        verifiedAt: null,
        notes: null,
      },
    });

    await this.auditService.log({
      eventType: 'DOCUMENT_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Submitted ${documentType.name}`,
    });

    return record;
  }

  async verifyDocument(
    employeeId: string,
    documentTypeId: string,
    dto: VerifyDocumentDto,
    actor: AuthContext,
  ) {
    const record = await this.prisma.employeeDocument.findUnique({
      where: { employeeId_documentTypeId: { employeeId, documentTypeId } },
    });
    if (!record || record.status !== 'PENDING_REVIEW') {
      throw new ConflictException(
        'Only a submitted, pending-review document can be verified or rejected',
      );
    }

    const updated = await this.prisma.employeeDocument.update({
      where: { employeeId_documentTypeId: { employeeId, documentTypeId } },
      data: {
        status: dto.decision,
        verifiedByUserId: actor.userId,
        verifiedAt: new Date(),
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      eventType: 'DOCUMENT_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Document ${dto.decision === 'VERIFIED' ? 'verified' : 'rejected'}`,
    });

    return updated;
  }

  /**
   * `EmployeeDocument` rows are only created for real on first submission
   * (same synthesize-on-read pattern as Leave balances and Attendance
   * history gaps) — every active `DocumentType` a real row doesn't exist
   * for yet is shown as MISSING without persisting anything.
   */
  private async getChecklist(employeeId: string) {
    const [documentTypes, records] = await Promise.all([
      this.prisma.documentType.findMany(),
      this.prisma.employeeDocument.findMany({ where: { employeeId } }),
    ]);
    const recordByType = new Map(
      records.map((record) => [record.documentTypeId, record]),
    );

    return documentTypes.map((documentType) => {
      const record = recordByType.get(documentType.id);
      return {
        documentTypeId: documentType.id,
        key: documentType.key,
        name: documentType.name,
        category: documentType.category,
        status: record?.status ?? 'MISSING',
        fileUrl: record?.fileUrl ?? null,
        uploadedAt: record?.uploadedAt ?? null,
        verifiedAt: record?.verifiedAt ?? null,
        notes: record?.notes ?? null,
      };
    });
  }

  private async requireEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee)
      throw new NotFoundException(
        'No employee profile is linked to this account',
      );
    return employee.id;
  }
}
