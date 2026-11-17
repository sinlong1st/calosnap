import { Text, type TextProps, type TextStyle } from 'react-native';

import {
  colors,
  fontFamily,
  MAX_FONT_SCALE,
  typography,
  type ColorToken,
  type FontWeight,
  type TypeVariant,
} from '@/theme/theme';

export type AppTextProps = TextProps & {
  /** Token type scale entry. Defaults to `body`. */
  variant?: TypeVariant;
  /** Override size where the board uses an off-scale size (e.g. 16/700 card titles). */
  size?: number;
  weight?: FontWeight;
  color?: ColorToken;
  /** Tabular figures for numbers that change (totals, counters). */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
};

/**
 * The only text primitive. Custom fonts on Android do not synthesize weights, so each
 * weight maps to its own registered family instead of using `fontWeight`.
 */
export function AppText({
  variant = 'body',
  size,
  weight,
  color = 'text',
  numeric,
  align,
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...rest
}: AppTextProps) {
  const t = typography[variant];
  const fontSize = size ?? t.fontSize;
  const lineHeight = size ? Math.round(size * (t.lineHeight / t.fontSize)) : t.lineHeight;
  const base: TextStyle = {
    fontFamily: fontFamily[weight ?? t.weight],
    fontSize,
    lineHeight,
    letterSpacing: size ? +((t.letterSpacing / t.fontSize) * size).toFixed(2) : t.letterSpacing,
    color: colors[color],
    textAlign: align,
    fontVariant: numeric ? ['tabular-nums'] : undefined,
  };
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[base, style]} {...rest} />;
}
