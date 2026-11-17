import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { boardColors, colors } from '@/theme/theme';

import { AppText } from './AppText';

export type SelectableCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Optional right-hand content (e.g. a value). */
  trailing?: ReactNode;
  /** Mode cards on S2 use 14 × 16 padding. */
  compact?: boolean;
  testID?: string;
};

/** Design §7 Selectable card (goal, activity, mode) with a radio indicator. */
export function SelectableCard({ title, description, selected, onPress, trailing, compact, testID }: SelectableCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: compact ? 14 : 16,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: selected ? colors.primary : 'transparent',
        backgroundColor: selected ? colors.accentTint : colors.surface,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? colors.primary : boardColors.radioOff,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <AppText size={16} weight={700}>
          {title}
        </AppText>
        {description ? (
          <AppText size={13} weight={500} color="textMuted" style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
