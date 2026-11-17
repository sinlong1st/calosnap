import { Pressable, View } from 'react-native';

import { dayOfMonth, formatLongDate, weekdayShort } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { colors } from '@/theme/theme';

import { AppText } from './AppText';

export type WeekStripProps = {
  days: LocalDate[];
  selected: LocalDate;
  onSelect?: (d: LocalDate) => void;
};

/** 7-day strip (Home H2, History D1). Selected day: forest fill. */
export function WeekStrip({ days, selected, onSelect }: WeekStripProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="tablist">
      {days.map((d) => {
        const on = d === selected;
        return (
          <Pressable
            key={d}
            testID={`week-${d}`}
            onPress={onSelect ? () => onSelect(d) : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={formatLongDate(d)}
            style={{
              flex: 1,
              minHeight: 54,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              backgroundColor: on ? colors.primary : colors.surface,
            }}
          >
            <AppText size={11} weight={500} color={on ? 'onPrimary' : 'text'} style={{ opacity: 0.8 }} maxFontSizeMultiplier={1.4}>
              {weekdayShort(d)}
            </AppText>
            <AppText size={15} weight={700} color={on ? 'onPrimary' : 'text'} numeric maxFontSizeMultiplier={1.4}>
              {dayOfMonth(d)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
