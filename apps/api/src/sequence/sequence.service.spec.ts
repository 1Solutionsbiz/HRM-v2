import { describe, expect, it, vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';
import { SequenceService } from './sequence.service.js';

describe('SequenceService', () => {
  it('returns the incremented value', async () => {
    const prisma = {
      sequenceCounter: {
        update: vi.fn().mockResolvedValue({ key: 'employeeCode', value: 5 }),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SequenceService(prisma as any);

    await expect(service.next('employeeCode')).resolves.toBe(5);
    expect(prisma.sequenceCounter.update).toHaveBeenCalledWith({
      where: { key: 'employeeCode' },
      data: { value: { increment: 1 } },
    });
  });

  it('raises a clear error instead of silently creating the row when unseeded', async () => {
    const prisma = {
      sequenceCounter: {
        update: vi.fn().mockRejectedValue(new Error('Record not found')),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new SequenceService(prisma as any);

    await expect(service.next('missing-key')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
