import type { SplitExpenseCategory } from '@db/schema';

export interface SplitCategoryMeta {
  value: SplitExpenseCategory;
  label: string;
  icon: string;
}

/**
 * Deliberately small category set inherited from the original Trip Split app.
 * These are descriptive labels only; they do not interact with Track categories.
 */
export const SPLIT_CATEGORIES: readonly SplitCategoryMeta[] = [
  { value: 'food', label: 'Food', icon: '🍽️' },
  { value: 'stay', label: 'Stay', icon: '🏨' },
  { value: 'travel', label: 'Travel', icon: '🚕' },
  { value: 'fun', label: 'Fun', icon: '🎟️' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'other', label: 'Other', icon: '•' },
] as const;

export function getSplitCategoryMeta(category?: SplitExpenseCategory): SplitCategoryMeta {
  return SPLIT_CATEGORIES.find((item) => item.value === category) ?? SPLIT_CATEGORIES[SPLIT_CATEGORIES.length - 1]!;
}
