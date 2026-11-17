import type { Goal, MealType } from './types';

/** "2050" → "2,050". Deterministic (no locale dependency) for the English-only MVP (D10). */
export function formatInt(n: number): string {
  const r = Math.round(n);
  const sign = r < 0 ? '-' : '';
  return sign + Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Labels exactly as drawn on Design v1.1 (O2, Home goal pill). */
export const GOAL_LABEL: Record<Goal, string> = {
  weight_loss: 'Weight loss',
  healthy_gain: 'Healthy weight gain',
  bulk: 'Muscle bulk',
  cut: 'Gym cut',
  maintain: 'Maintain',
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
