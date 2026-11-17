import { View } from 'react-native';

import { boardColors } from '@/theme/theme';

/**
 * Meal thumbnail slot. Real thumbnails are device-local only (v1.2 D6) and arrive with
 * the scan flow; until then this matches the board's neutral placeholder.
 */
export function PhotoPlaceholder({ size = 58, radius = 16 }: { size?: number; radius?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: boardColors.photoPlaceholder }}
    />
  );
}
