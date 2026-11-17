import { View, type ViewStyle } from 'react-native';

import { colors, radius, type ColorToken } from '@/theme/theme';

import { AppText } from './AppText';

export type ChipProps = {
  label: string;
  background?: string;
  color?: ColorToken;
  /** Optional 7–8 pt leading dot (impact chips, banners). */
  dotColor?: string;
  style?: ViewStyle;
};

/** Small pill label (12/600). Used for the Home goal pill and, later, basis/impact chips. */
export function Chip({ label, background = colors.surfaceMuted, color = 'primary', dotColor, style }: ChipProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: background,
        },
        style,
      ]}
    >
      {dotColor ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dotColor }} /> : null}
      <AppText variant="small" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
