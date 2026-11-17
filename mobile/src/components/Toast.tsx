import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, View, type ViewStyle } from 'react-native';

import { boardColors, colors, motion, shadow } from '@/theme/theme';

import { AppText } from './AppText';

export type ToastProps = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Called after `durationMs` (default 6 s, Design §7). */
  onDismiss: () => void;
  durationMs?: number;
  style?: ViewStyle;
};

/**
 * Design §7 Toast: forest background, sage check, optional Undo. Auto-dismisses and
 * announces itself to the screen reader. Position it 14 pt above the tab bar.
 */
export function Toast({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = motion.toastDurationMs,
  style,
}: ToastProps) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility(actionLabel ? `${message}. ${actionLabel} available.` : message);
    const t = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [visible, message, actionLabel, durationMs]);

  if (!visible) return null;

  return (
    <View
      testID="toast"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.primary,
          borderRadius: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          boxShadow: shadow.toast,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText size={12} weight={700} style={{ color: boardColors.toastCheckText }}>
          ✓
        </AppText>
      </View>
      <AppText size={14} weight={600} color="onPrimary" style={{ flex: 1 }}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={12}>
          <AppText size={14} weight={700} style={{ color: boardColors.toastAction }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
