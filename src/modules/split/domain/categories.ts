import type { SplitExpenseCategory } from '@db/schema';

export interface SplitCategoryMeta {
  value: SplitExpenseCategory;
  label: string;
}

export const SPLIT_CATEGORIES: readonly SplitCategoryMeta[] = [
  { value: 'food', label: 'Food' },
  { value: 'stay', label: 'Stay' },
  { value: 'travel', label: 'Travel' },
  { value: 'fun', label: 'Fun' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
] as const;

export function getSplitCategoryMeta(category?: SplitExpenseCategory): SplitCategoryMeta {
  return SPLIT_CATEGORIES.find((item) => item.value === category) ?? SPLIT_CATEGORIES[SPLIT_CATEGORIES.length - 1]!;
}
