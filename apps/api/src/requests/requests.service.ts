import { Injectable } from '@nestjs/common';
import { LeaveService } from '../leave/leave.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { formatDateOnly } from '../common/date-only.js';

export type RequestKind = 'Leave' | 'Expense';

export interface UnifiedRequest {
  id: string;
  kind: RequestKind;
  title: string;
  detail: string;
  status: string;
  submittedOn: string;
}

/**
 * A read-only aggregator, not a domain of its own — there is no `Request`
 * table (matches `apps/web/src/lib/mock/mock-api.ts`'s `getMyRequests()`,
 * which merges `leaveRequestStore` + `expenseStore` client-side).
 * Complaints/Resignation could plausibly join this list too, but the mock
 * only ever combines Leave+Expense, so nothing else is assumed.
 */
@Injectable()
export class RequestsService {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly expensesService: ExpensesService,
  ) {}

  async getMyRequests(userId: string): Promise<UnifiedRequest[]> {
    const [leaveRequests, expenseClaims] = await Promise.all([
      this.leaveService.getMyRequests(userId),
      this.expensesService.getMyClaims(userId),
    ]);

    const fromLeave: UnifiedRequest[] = leaveRequests.map((request) => ({
      id: request.id,
      kind: 'Leave',
      title: `${request.leaveType.name} · ${request.dayType === 'HALF_DAY' ? 'Half Day' : 'Full Day'}`,
      detail:
        request.startDate.getTime() === request.endDate.getTime()
          ? formatDateOnly(request.startDate)
          : `${formatDateOnly(request.startDate)} → ${formatDateOnly(request.endDate)}`,
      status: request.status,
      submittedOn: request.submittedAt.toISOString(),
    }));

    const fromExpenses: UnifiedRequest[] = expenseClaims.map((claim) => ({
      id: claim.id,
      kind: 'Expense',
      title: claim.category.name,
      detail: `${claim.amount.toLocaleString('en-IN')} · ${claim.description}`,
      status: claim.status,
      submittedOn: claim.submittedAt.toISOString(),
    }));

    return [...fromLeave, ...fromExpenses].sort((a, b) =>
      a.submittedOn < b.submittedOn ? 1 : -1,
    );
  }
}
