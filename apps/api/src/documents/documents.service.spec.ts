import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    documentType: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    employeeDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['employee:manage'],
};

describe('DocumentsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DocumentsService(prisma as any, auditService as any);
  });

  describe('getMyDocuments', () => {
    it('synthesizes MISSING for a document type with no submitted row', async () => {
      prisma.documentType.findMany.mockResolvedValue([
        {
          id: 'dt-1',
          key: 'aadhaar',
          name: 'Aadhaar card',
          category: 'IDENTITY',
        },
      ]);
      prisma.employeeDocument.findMany.mockResolvedValue([]);

      const result = await service.getMyDocuments('user-1');

      expect(result).toEqual([
        {
          documentTypeId: 'dt-1',
          key: 'aadhaar',
          name: 'Aadhaar card',
          category: 'IDENTITY',
          status: 'MISSING',
          fileUrl: null,
          uploadedAt: null,
          verifiedAt: null,
          notes: null,
        },
      ]);
    });

    it('uses the real EmployeeDocument row when one has been submitted', async () => {
      prisma.documentType.findMany.mockResolvedValue([
        {
          id: 'dt-1',
          key: 'aadhaar',
          name: 'Aadhaar card',
          category: 'IDENTITY',
        },
      ]);
      prisma.employeeDocument.findMany.mockResolvedValue([
        {
          documentTypeId: 'dt-1',
          status: 'PENDING_REVIEW',
          fileUrl: 'https://x/aadhaar.pdf',
          uploadedAt: new Date(),
          verifiedAt: null,
          notes: null,
        },
      ]);

      const result = await service.getMyDocuments('user-1');
      expect(result[0].status).toBe('PENDING_REVIEW');
      expect(result[0].fileUrl).toBe('https://x/aadhaar.pdf');
    });
  });

  describe('submitDocument', () => {
    it('throws for an unknown document type', async () => {
      prisma.documentType.findUnique.mockResolvedValue(null);
      await expect(
        service.submitDocument(
          'user-1',
          'missing',
          { fileUrl: 'https://x/y.pdf' },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets status to PENDING_REVIEW and clears any prior review outcome', async () => {
      prisma.documentType.findUnique.mockResolvedValue({
        id: 'dt-1',
        name: 'Aadhaar card',
      });
      prisma.employeeDocument.upsert.mockResolvedValue({
        status: 'PENDING_REVIEW',
      });

      await service.submitDocument(
        'user-1',
        'dt-1',
        { fileUrl: 'https://x/y.pdf' },
        actor,
      );

      expect(prisma.employeeDocument.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'PENDING_REVIEW',
            verifiedByUserId: null,
            verifiedAt: null,
            notes: null,
          }),
        }),
      );
    });
  });

  describe('verifyDocument', () => {
    it('rejects verifying a document that was never submitted', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyDocument(
          'emp-1',
          'dt-1',
          { decision: 'VERIFIED' },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects re-verifying an already-decided document', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({
        status: 'VERIFIED',
      });
      await expect(
        service.verifyDocument(
          'emp-1',
          'dt-1',
          { decision: 'VERIFIED' },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('verifies a pending-review document', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({
        status: 'PENDING_REVIEW',
      });
      prisma.employeeDocument.update.mockResolvedValue({ status: 'VERIFIED' });

      const result = await service.verifyDocument(
        'emp-1',
        'dt-1',
        { decision: 'VERIFIED' },
        actor,
      );

      expect(prisma.employeeDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'VERIFIED',
            verifiedByUserId: 'hr-1',
          }),
        }),
      );
      expect(result.status).toBe('VERIFIED');
    });
  });
});
