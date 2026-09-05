import { describe, expect, it, vi } from 'vitest';
import { RequestsService } from './requests.service.js';

describe('RequestsService', () => {
  it('maps leave requests into the unified shape, newest first', async () => {
    const leaveService = {
      getMyRequests: vi.fn().mockResolvedValue([
        {
          id: 'lr-1',
          leaveType: { key: 'casual', name: 'Casual Leave' },
          dayType: 'FULL_DAY',
          startDate: new Date('2026-09-14'),
          endDate: new Date('2026-09-14'),
          status: 'PENDING',
          submittedAt: new Date('2026-09-05T10:00:00.000Z'),
        },
        {
          id: 'lr-2',
          leaveType: { key: 'sick', name: 'Sick Leave' },
          dayType: 'FULL_DAY',
          startDate: new Date('2026-08-19'),
          endDate: new Date('2026-08-20'),
          status: 'APPROVED',
          submittedAt: new Date('2026-08-19T10:00:00.000Z'),
        },
      ]),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new RequestsService(leaveService as any);

    const result = await service.getMyRequests('user-1');

    expect(result).toEqual([
      {
        id: 'lr-1',
        kind: 'Leave',
        title: 'Casual Leave · Full Day',
        detail: '2026-09-14',
        status: 'PENDING',
        submittedOn: '2026-09-05T10:00:00.000Z',
      },
      {
        id: 'lr-2',
        kind: 'Leave',
        title: 'Sick Leave · Full Day',
        detail: '2026-08-19 → 2026-08-20',
        status: 'APPROVED',
        submittedOn: '2026-08-19T10:00:00.000Z',
      },
    ]);
  });

  it('renders a half-day request distinctly', async () => {
    const leaveService = {
      getMyRequests: vi.fn().mockResolvedValue([
        {
          id: 'lr-1',
          leaveType: { key: 'casual', name: 'Casual Leave' },
          dayType: 'HALF_DAY',
          startDate: new Date('2026-09-14'),
          endDate: new Date('2026-09-14'),
          status: 'PENDING',
          submittedAt: new Date('2026-09-05T10:00:00.000Z'),
        },
      ]),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new RequestsService(leaveService as any);

    const result = await service.getMyRequests('user-1');
    expect(result[0].title).toBe('Casual Leave · Half Day');
  });
});
