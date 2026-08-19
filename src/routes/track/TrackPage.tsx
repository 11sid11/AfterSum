/**
 * Track landing page — renders the current month.
 */

import { toMonthKey } from '@shared/dates';
import { TrackMonthView } from '@modules/track/components/TrackMonthView';

export function TrackPage() {
  return <TrackMonthView month={toMonthKey()} />;
}
