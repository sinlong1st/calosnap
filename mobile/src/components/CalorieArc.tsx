import { View } from 'react-native';

import { formatInt } from '@/domain/format';
import { ARC_SEGMENTS, arcFilledSegments, calorieStatus } from '@/domain/progress';
import { colors } from '@/theme/theme';

import { AppText } from './AppText';

export type CalorieArcProps = {
  consumed: number;
  target: number;
  testID?: string;
};

// Geometry from Design §7 / board: 270 × 150 box, 15 segments of 34 × 15 (radius 6)
// on a 112 pt radius semicircle, centred at (135, 135.5).
const BOX_W = 270;
const BOX_H = 150;
const SEG_W = 34;
const SEG_H = 15;
const R = 112;
const CX = BOX_W / 2;
const CY = 128 + SEG_H / 2;

/** Segment layout, left (i = 0) to right (i = 14) across the top. */
export const ARC_LAYOUT = Array.from({ length: ARC_SEGMENTS }, (_, i) => {
  const deg = (i * 180) / (ARC_SEGMENTS - 1);
  const rad = (deg * Math.PI) / 180;
  return {
    left: CX - R * Math.cos(rad) - SEG_W / 2,
    top: CY - R * Math.sin(rad) - SEG_H / 2,
    deg,
  };
});

/**
 * Home calorie arc. Over target: every segment stays filled and the centre reads
 * "X kcal over" in `onEstimateTint` — never red (Design §7).
 */
export function CalorieArc({ consumed, target, testID }: CalorieArcProps) {
  const filled = arcFilledSegments(consumed, target);
  const status = calorieStatus(consumed, target);
  const over = status.kind === 'over';
  const a11y = over
    ? `${formatInt(status.value)} calories over your ${formatInt(target)} calorie target`
    : `${formatInt(status.value)} of ${formatInt(target)} calories remaining`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11y}
      style={{ width: BOX_W, height: BOX_H, alignSelf: 'center', marginTop: 14 }}
    >
      {ARC_LAYOUT.map((s, i) => (
        <View
          key={i}
          testID={i < filled ? 'arc-seg-filled' : 'arc-seg-empty'}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: SEG_W,
            height: SEG_H,
            borderRadius: 6,
            backgroundColor: i < filled ? colors.primary : colors.arcEmpty,
            transform: [{ rotate: `${s.deg}deg` }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 62, alignItems: 'center' }}>
        <AppText
          variant="display"
          numeric
          color={over ? 'onEstimateTint' : 'text'}
          maxFontSizeMultiplier={1}
          adjustsFontSizeToFit
          minimumFontScale={32 / 44}
          numberOfLines={1}
        >
          {formatInt(status.value)}
        </AppText>
        <AppText variant="caption" color={over ? 'onEstimateTint' : 'textMuted'} style={{ marginTop: 4 }} maxFontSizeMultiplier={1.3}>
          {over ? 'kcal over' : 'kcal remaining'}
        </AppText>
      </View>
    </View>
  );
}
