import { toSavedMeal } from '@/api/mock/fixtures';
import type { LocalDate, SavedMeal } from '@/domain/types';

import { arcFilledSegments, calorieStatus, macroProgress, sumSavedMeals } from '../progress';

const D = '2026-11-16' as LocalDate;

describe('arcFilledSegments (Design §7)', () => {
  it.each([
    [0, 2050, 0],
    [1120, 2050, 8], // H2 board: arcB = 8
    [1795, 2050, 13], // H3 board: arcA = 13
    [2050, 2050, 15],
    [3000, 2050, 15], // capped when over target
    [-50, 2050, 0],
  ])('consumed %d of %d → %d segments', (consumed, target, expected) => {
    expect(arcFilledSegments(consumed, target)).toBe(expected);
  });

  it('returns 0 for a missing or zero target', () => {
    expect(arcFilledSegments(500, 0)).toBe(0);
  });
});

describe('calorieStatus', () => {
  it('reports remaining calories', () => {
    expect(calorieStatus(1120, 2050)).toEqual({ kind: 'remaining', value: 930 });
  });
  it('reports exactly on target as 0 remaining', () => {
    expect(calorieStatus(2050, 2050)).toEqual({ kind: 'remaining', value: 0 });
  });
  it('reports over target without negative numbers', () => {
    expect(calorieStatus(2925, 2050)).toEqual({ kind: 'over', value: 875 });
  });
  it('uses rounded display values so label and number agree', () => {
    expect(calorieStatus(2050.4, 2050)).toEqual({ kind: 'remaining', value: 0 });
  });
});

describe('macroProgress', () => {
  it('computes left and fill for the H2 protein bar', () => {
    expect(macroProgress(88, 165)).toEqual({ eaten: 88, target: 165, left: 77, over: 0, fraction: 88 / 165 });
  });
  it('clips the bar at 100 % and reports grams over', () => {
    const p = macroProgress(70, 62);
    expect(p.fraction).toBe(1);
    expect(p.left).toBe(0);
    expect(p.over).toBe(8);
  });
  it('handles a zero target', () => {
    expect(macroProgress(10, 0).fraction).toBe(0);
  });
});

describe('sumSavedMeals ("Scan ≠ eaten")', () => {
  const meals = [
    toSavedMeal(D, { name: 'A', type: 'breakfast', time: '08:00', kcal: 520, p: 24, c: 64, f: 20 }),
    toSavedMeal(D, { name: 'B', type: 'snack', time: '10:45', kcal: 600, p: 64, c: 56, f: 18 }),
  ];

  it('sums persisted meals', () => {
    expect(sumSavedMeals(meals)).toEqual({ kcal: 1120, proteinG: 88, carbsG: 120, fatG: 38 });
  });

  it('returns zero totals for an empty day', () => {
    expect(sumSavedMeals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('rejects anything that is not a saved diary meal at runtime', () => {
    const draft = { ...meals[0], kind: 'draft' } as unknown as SavedMeal;
    expect(() => sumSavedMeals([draft])).toThrow(/only persisted diary meals/);
  });

  it('rejects a draft at compile time', () => {
    const draftLike = { kcal: 500, proteinG: 1, carbsG: 1, fatG: 1 };
    // @ts-expect-error a scan draft is not a SavedMeal
    expect(() => sumSavedMeals([draftLike])).toThrow();
  });
});
