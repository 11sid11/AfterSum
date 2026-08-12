/**
 * Track month page — same view, parametrised by $year/$month.
 */

import { useParams } from '@tanstack/react-router';
import { TrackMonthView } from '@modules/track/components/TrackMonthView';

export function TrackMonthPage() {
  const { year, month } = useParams({ strict: false }) as { year?: string; month?: string };
  const yyyy = year ?? '';
  const mm = (month ?? '').padStart(2, '0');
  return <TrackMonthView month={`${yyyy}-${mm}`} />;
}
