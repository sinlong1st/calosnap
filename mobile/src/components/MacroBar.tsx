import { View } from 'react-native';

import { macroProgress } from '@/domain/progress';
import { colors, size } from '@/theme/theme';

import { AppText } from './AppText';

export type MacroBarProps = {
  name: string;
  eaten: number;
  target: number;
  /** H2 shows "· N g left"; H1 (empty day) shows only "0 / 165 g". */
  showRemaining?: boolean;
};

/** Ledger-style macro bar (Design §7). The projected/hatched variant arrives with R1 (Checkpoint 3). */
export function MacroBar({ name, eaten, target, showRemaining = true }: MacroBarProps) {
  const p = macroProgress(eaten, target);
  const tail = p.over > 0 ? `${p.over} g over` : `${p.left} g left`;
  const a11y = `${name}, ${p.eaten} of ${p.target} grams, ${p.over > 0 ? `${p.over} over` : `${p.left} left`}`;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={a11y}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <AppText size={13} weight={600}>
          {name}
        </AppText>
        <AppText size={13} weight={600} color="textMuted" numeric>
          {p.eaten} / {p.target} g
          {showRemaining ? (
            <>
              {' · '}
              <AppText size={13} weight={700} color="text" numeric>
                {tail}
              </AppText>
            </>
          ) : null}
        </AppText>
      </View>
      <View
        style={{
          height: size.macroBarHeight,
          borderRadius: 4,
          backgroundColor: colors.trackEmpty,
          marginTop: 6,
          overflow: 'hidden',
        }}
      >
        <View
          testID="macro-fill"
          style={{ height: size.macroBarHeight, width: `${p.fraction * 100}%`, backgroundColor: colors.primary }}
        />
      </View>
    </View>
  );
}
