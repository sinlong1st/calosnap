import { View, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme/theme';

export type CardProps = ViewProps & {
  /** Home hero card uses radius 28 (cardLarge). */
  large?: boolean;
  elevated?: boolean;
  padding?: number;
};

/** Design §7 Card: surface, radius 24 (hero 28), padding 18–20, shadow `card` or none. */
export function Card({ large, elevated = false, padding = 20, style, ...rest }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: large ? radius.cardLarge : radius.card,
    padding,
    boxShadow: elevated ? shadow.card : undefined,
  };
  return <View style={[base, style]} {...rest} />;
}
