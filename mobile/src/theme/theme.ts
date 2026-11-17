/**
 * CaloSnap "Garden" theme, derived from the approved design tokens (Design v1.1).
 *
 * `tokens.json` is a verbatim copy of `docs/design/tokens.json` and is the single
 * source of truth. This file only converts it into React Native units:
 *   - letterSpacing tokens are in `em` → converted to points (size × em)
 *   - lineHeight tokens are multipliers → converted to points (size × lh)
 */
import tokens from './tokens.json';

export type ColorToken = keyof typeof tokens.color;
export type TypeVariant = keyof typeof tokens.font.scale;
export type FontWeight = 400 | 500 | 600 | 700 | 800;

export const colors = tokens.color satisfies Record<string, string>;

/**
 * Values used on the design board that tokens.json does not define yet.
 * Kept in one place so design can promote them to tokens (see Checkpoint 1 report).
 */
export const boardColors = {
  /** Tab bar top border (board uses #EAE6DA; token `line` is #E6E2D6). */
  tabBarBorder: '#EAE6DA',
  /** Goal pill on the Home calorie card. */
  goalPill: '#EDEEE3',
  /** Dashed border of empty-state cards and "Not logged" slots. */
  dashedBorder: '#CFCABB',
  /** Radio ring, unselected. */
  radioOff: '#C9C4B6',
  /** Photo placeholder fill (board draws stripes of #E3DFD3 / #ECE9DF). */
  photoPlaceholder: '#E8E4D9',
  /** Confidence dot, empty. */
  dotEmpty: '#DDD8CB',
  /** Toast check circle text and Undo label. */
  toastCheckText: '#0F2A21',
  toastAction: '#C9DCC8',
} as const;

/** Plus Jakarta Sans family names as registered by @expo-google-fonts. */
export const fontFamily: Record<FontWeight, string> = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
};

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  weight: FontWeight;
};

function toTypeStyle(s: {
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacing?: number;
}): TypeStyle {
  return {
    fontSize: s.size,
    lineHeight: Math.round(s.size * s.lineHeight),
    letterSpacing: +(s.size * (s.letterSpacing ?? 0)).toFixed(2),
    weight: s.weight as FontWeight,
  };
}

export const typography = Object.fromEntries(
  Object.entries(tokens.font.scale).map(([k, v]) => [k, toTypeStyle(v)]),
) as Record<TypeVariant, TypeStyle>;

export const space = tokens.space;
export const radius = tokens.radius;
export const size = tokens.size;
/** CSS box-shadow strings; React Native ≥ 0.76 supports `boxShadow` on both platforms. */
export const shadow = tokens.shadow;

export const motion = {
  fastMs: 150,
  standardMs: 250,
  sheetMs: 320,
  totalsUpdateMs: 600,
  precisionAutoAdvanceMs: 300,
  toastDurationMs: 6000,
} as const;

/** Max Dynamic Type scale the layouts must support (Design §11: at least 200 %). */
export const MAX_FONT_SCALE = 2;

export const theme = { colors, boardColors, fontFamily, typography, space, radius, size, shadow, motion };
export type Theme = typeof theme;
