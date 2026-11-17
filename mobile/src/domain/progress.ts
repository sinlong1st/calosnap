import type { NutrientTotals, SavedMeal } from './types';

export const ZERO_TOTALS: NutrientTotals = Object.freeze({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

/**
 * Daily totals from persisted diary entries only.
 * The parameter type is `SavedMeal`, which a scan draft can never satisfy (`kind: 'saved'`),
 * and the runtime guard rejects anything else — enforcing "Scan ≠ eaten" (Design rule 1).
 */
export function sumSavedMeals(meals: readonly SavedMeal[]): NutrientTotals {
  return meals.reduce<NutrientTotals>(
    (acc, m) => {
      if (m.kind !== 'saved') {
        throw new Error('sumSavedMeals: only persisted diary meals may contribute to daily totals');
      }
      return {
        kcal: acc.kcal + m.kcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      };
    },
    { ...ZERO_TOTALS },
  );
}

export const ARC_SEGMENTS = 15;

/** Design §7: a segment is filled when i < round(consumed / target × 15), capped at 15. */
export function arcFilledSegments(consumed: number, target: number, segments = ARC_SEGMENTS): number {
  if (target <= 0) return 0;
  const n = Math.round((Math.max(0, consumed) / target) * segments);
  return Math.min(segments, Math.max(0, n));
}

export type CalorieStatus =
  | { kind: 'remaining'; value: number }
  | { kind: 'over'; value: number };

/** Remaining vs over, on rounded display values so the label and the number always agree. */
export function calorieStatus(consumed: number, target: number): CalorieStatus {
  const diff = Math.round(target) - Math.round(consumed);
  return diff >= 0 ? { kind: 'remaining', value: diff } : { kind: 'over', value: -diff };
}

export type MacroProgress = {
  eaten: number;
  target: number;
  /** Grams left (≥ 0). */
  left: number;
  /** Grams over target (≥ 0). */
  over: number;
  /** Fill fraction for the bar, clipped to [0, 1] (Design §7: overflow is clipped). */
  fraction: number;
};

export function macroProgress(eaten: number, target: number): MacroProgress {
  const e = Math.round(eaten);
  const t = Math.round(target);
  return {
    eaten: e,
    target: t,
    left: Math.max(0, t - e),
    over: Math.max(0, e - t),
    fraction: t > 0 ? Math.min(1, Math.max(0, e / t)) : 0,
  };
}
