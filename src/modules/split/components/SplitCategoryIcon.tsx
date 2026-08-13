import {
  BedDouble,
  CarFront,
  CircleEllipsis,
  ShoppingBag,
  Ticket,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { SplitExpenseCategory } from '@db/schema';

const CATEGORY_ICONS: Record<SplitExpenseCategory, LucideIcon> = {
  food: Utensils,
  stay: BedDouble,
  travel: CarFront,
  fun: Ticket,
  shopping: ShoppingBag,
  other: CircleEllipsis,
};

export function SplitCategoryIcon({
  category,
  size = 18,
  className,
}: {
  category?: SplitExpenseCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category ?? 'other'];
  return <Icon size={size} className={className} aria-hidden="true" />;
}
