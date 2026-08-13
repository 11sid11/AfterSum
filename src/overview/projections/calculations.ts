import type { CurrencyCode } from '@shared/money';
import type { SplitExpense, SplitGroup, SplitShare } from '@db/schema';
import { isInMonth } from '@shared/dates';

interface SplitPersonalShareInput {
  month: string;
  currency: CurrencyCode;
  selfPersonId: string;
  groups: SplitGroup[];
  expenses: SplitExpense[];
  shares: SplitShare[];
}

/**
 * Sum the current user's economic share of active Split expenses in a month.
 * This is a read-only projection: it does not represent cash paid or settlement activity.
 */
export function calculateSplitPersonalShareForMonth(input: SplitPersonalShareInput): number {
  const activeGroupIds = new Set(
    input.groups.filter((group) => !group.deletedAt).map((group) => group.id),
  );
  const relevantExpenseIds = new Set(
    input.expenses
      .filter((expense) => !expense.deletedAt)
      .filter((expense) => activeGroupIds.has(expense.groupId))
      .filter((expense) => expense.currency === input.currency)
      .filter((expense) => isInMonth(expense.date, input.month))
      .map((expense) => expense.id),
  );

  return input.shares
    .filter((share) => !share.deletedAt)
    .filter((share) => share.personId === input.selfPersonId)
    .filter((share) => relevantExpenseIds.has(share.expenseId))
    .reduce((sum, share) => sum + share.amountMinor, 0);
}
