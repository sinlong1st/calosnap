/**
 * Domain types shared by UI and the API layer.
 * Shapes follow Architecture Review v1.1 §4.3 / §5 as revised by v1.2 §2 and §4.
 */

/** Calendar date in the user's local timezone, `YYYY-MM-DD`. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

export const GOALS = ['weight_loss', 'healthy_gain', 'bulk', 'cut', 'maintain'] as const;
export type Goal = (typeof GOALS)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type Confidence = 'low' | 'medium' | 'high';
export type ScanMode = 'auto' | 'precision';

export type Macros = {
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type NutrientTotals = Macros & { kcal: number };

/**
 * A meal persisted in the diary. Values are the server-computed snapshot
 * (v1.1 §5 / A8). Daily totals may only be derived from this type — never
 * from a scan draft (Design rule 1, "Scan ≠ eaten").
 */
export type SavedMeal = NutrientTotals & {
  readonly kind: 'saved';
  id: string;
  displayName: string;
  mealType: MealType;
  /** ISO-8601 with offset. */
  eatenAt: string;
  localDate: LocalDate;
  kcalLow: number;
  kcalHigh: number;
  mode: ScanMode | null;
  confidence: Confidence | null;
  revision: number;
};

export type TargetSource = 'recommended' | 'manual' | 'none';

/** The frozen target for one local day (v1.2 §4, `daily_target_snapshots`). */
export type DayTarget = {
  source: TargetSource;
  /** Null when source is `none` (no target set, e.g. under-18 without manual targets). */
  values: NutrientTotals | null;
  formulaVersion: string | null;
  changedToday: boolean;
};

export type DaySummary = {
  localDate: LocalDate;
  meals: SavedMeal[];
  totals: NutrientTotals;
  target: DayTarget;
};

export type DayTotalsSummary = {
  localDate: LocalDate;
  totals: NutrientTotals;
  mealCount: number;
  target: DayTarget;
};

export type Profile = {
  displayName: string;
  goal: Goal;
  /** True until the user has saved at least one meal (drives "Welcome" vs time-of-day greeting). */
  isNewUser: boolean;
  timezone: string;
};

export type Me = {
  profile: Profile;
};
