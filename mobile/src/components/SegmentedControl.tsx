import { Pressable, View } from 'react-native';

import { colors, radius, shadow } from '@/theme/theme';

import { AppText } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** `camera` = translucent track on the dark camera/preview screens. */
  tone?: 'light' | 'camera';
  accessibilityLabel?: string;
};

/** Design §7 Segmented control (Auto/Precision, Female/Male). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const camera = tone === 'camera';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: radius.pill,
        backgroundColor: camera ? 'rgba(255,255,255,0.10)' : colors.surfaceSegmented,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`segment-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? (camera ? colors.bg : colors.surface) : 'transparent',
              boxShadow: on ? shadow.segmentActive : undefined,
            }}
          >
            <AppText size={14} weight={700} color={on ? 'primary' : camera ? 'onCameraMuted' : 'textMuted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
