import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, size } from '@/theme/theme';

import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text';
export type ButtonSize = 'regular' | 'compact' | 'small';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows an inline spinner and disables the button (e.g. Save in progress). */
  loading?: boolean;
  /** Stretch to the parent's width (default for regular/compact). */
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = {
  regular: size.buttonHeight,
  compact: size.buttonHeightCompact,
  small: 46,
};

/** Design §7 Buttons: primary, secondary, destructive secondary, text button, disabled. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size: s = 'regular',
  disabled = false,
  loading = false,
  fullWidth,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const isText = variant === 'text';
  const stretch = fullWidth ?? (s !== 'small' && !isText);

  const container: ViewStyle = isText
    ? { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' }
    : {
        height: HEIGHT[s],
        paddingHorizontal: s === 'small' ? 22 : 24,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        alignSelf: stretch ? 'stretch' : 'flex-start',
        backgroundColor: inactive
          ? colors.disabledBg
          : variant === 'primary'
            ? colors.primary
            : colors.surface,
        borderWidth: !inactive && variant !== 'primary' ? 1.5 : 0,
        borderColor: colors.borderButton,
      };

  const textColor = inactive
    ? 'disabledText'
    : variant === 'primary'
      ? 'onPrimary'
      : variant === 'destructive'
        ? 'danger'
        : variant === 'text'
          ? 'primary'
          : 'text';

  const fontSize = isText ? 14 : s === 'regular' && variant === 'primary' ? 16 : s === 'small' ? 14 : 15;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={isText ? 8 : undefined}
      style={({ pressed }) => [
        container,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={colors.disabledText} />
        </View>
      ) : null}
      <AppText
        size={fontSize}
        weight={700}
        color={textColor}
        style={isText ? styles.underline : undefined}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  spinner: { marginRight: 8 },
  underline: { textDecorationLine: 'underline' },
});
