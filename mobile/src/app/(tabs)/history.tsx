import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { formatLongDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

export default function HistoryRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const valid = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <PlaceholderScreen
      title="History"
      note={`The food diary (D1/D2) is built in Checkpoint 4.${
        valid ? ` Requested day: ${formatLongDate(date as LocalDate)}.` : ''
      }`}
    />
  );
}
