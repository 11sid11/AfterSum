/**
 * Track landing page — renders the current month.
 */

import { todayDateOnly, toMonthKey } from '@shared/dates';
import { TrackMonthView } from '@modules/track/components/TrackMonthView';

export function TrackPage() {
  const month = toMonthKey(new Date(todayDateOnly()));
  return <TrackMonthView month={month} />;
}
