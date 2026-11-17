import { View, type ViewStyle } from 'react-native';

import { colors } from '@/theme/theme';

import { AppText } from './AppText';

export type BannerTone = 'offline' | 'error';

const TONE = {
  offline: { bg: colors.estimateTint, fg: 'onEstimateTint', dot: colors.estimate },
  error: { bg: colors.dangerTint, fg: 'onDangerTint', dot: colors.danger },
} as const;

/** Design §7 Banners: offline (amber) and error (danger). Radius 14, 13/600, 8 pt dot. */
export function Banner({ tone, message, style }: { tone: BannerTone; message: string; style?: ViewStyle }) {
  const t = TONE[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: t.bg,
          borderRadius: 14,
          paddingVertical: 11,
          paddingHorizontal: 14,
        },
        style,
      ]}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.dot }} />
      <AppText size={13} weight={600} color={t.fg} style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}
