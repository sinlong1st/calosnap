/**
 * Mock data for the UI prototype. ALL VALUES ARE FIXTURES.
 *
 * The target values (2,050 kcal, P 165 / C 208 / F 62) are the Design v1.1 mock persona
 * ("Maya"). They are NOT produced by any formula and must not be read as approved
 * defaults: the Nutrition Goal Engine (D1) is still open.
 */
import { addDays, lastNDays } from '@/domain/dates';
import type { DayTarget, LocalDate, MealType, Profile, SavedMeal } from '@/domain/types';

export const FIXTURE_TARGET: DayTarget = {
  source: 'recommended',
  values: { kcal: 2050, proteinG: 165, carbsG: 208, fatG: 62 },
  formulaVersion: 'fixture.design-v1.1',
  changedToday: false,
};

export const FIXTURE_PROFILE: Profile = {
  displayName: 'Maya',
  goal: 'cut',
  isNewUser: false,
  timezone: 'Local',
};

type MealSeed = {
  name: string;
  type: MealType;
  time: string; // HH:mm local
  kcal: number;
  p: number;
  c: number;
  f: number;
};

/** Today's meals in Design H2 (totals 1,120 kcal · P 88 · C 120 · F 38). */
export const TODAY_SEEDS: MealSeed[] = [
  { name: 'Oats & peanut butter', type: 'breakfast', time: '08:12', kcal: 520, p: 24, c: 64, f: 20 },
  { name: 'Turkey wrap', type: 'snack', time: '10:45', kcal: 600, p: 64, c: 56, f: 18 },
];

/** Extra meals that push today over target (over-target state). */
export const OVER_TARGET_EXTRA: MealSeed[] = [
  { name: 'Chicken rice bowl', type: 'lunch', time: '12:41', kcal: 675, p: 42, c: 68, f: 24 },
  { name: 'Phở bò', type: 'dinner', time: '19:05', kcal: 480, p: 32, c: 58, f: 12 },
];

/** Rotating meals for the six days before today. */
const PAST_SEEDS: MealSeed[][] = [
  [
    { name: 'Bánh mì trứng', type: 'breakfast', time: '07:50', kcal: 430, p: 18, c: 52, f: 16 },
    { name: 'Cơm tấm sườn', type: 'lunch', time: '12:20', kcal: 780, p: 38, c: 92, f: 26 },
    { name: 'Greek yogurt', type: 'snack', time: '16:10', kcal: 180, p: 17, c: 12, f: 6 },
    { name: 'Salmon & greens', type: 'dinner', time: '19:30', kcal: 560, p: 42, c: 22, f: 32 },
  ],
  [
    { name: 'Oats & peanut butter', type: 'breakfast', time: '08:05', kcal: 520, p: 24, c: 64, f: 20 },
    { name: 'Bún chả', type: 'lunch', time: '12:45', kcal: 690, p: 34, c: 80, f: 24 },
    { name: 'Protein shake', type: 'snack', time: '17:30', kcal: 220, p: 30, c: 12, f: 5 },
  ],
  [
    { name: 'Xôi gà', type: 'breakfast', time: '08:30', kcal: 510, p: 22, c: 70, f: 15 },
    { name: 'Chicken rice bowl', type: 'lunch', time: '12:41', kcal: 675, p: 42, c: 68, f: 24 },
    { name: 'Gỏi cuốn (3)', type: 'dinner', time: '19:00', kcal: 360, p: 24, c: 48, f: 7 },
  ],
  [
    { name: 'Turkey wrap', type: 'lunch', time: '13:10', kcal: 600, p: 64, c: 56, f: 18 },
    { name: 'Mì xào bò', type: 'dinner', time: '19:40', kcal: 740, p: 36, c: 84, f: 28 },
  ],
  [
    { name: 'Bánh mì trứng', type: 'breakfast', time: '07:45', kcal: 430, p: 18, c: 52, f: 16 },
    { name: 'Phở bò', type: 'lunch', time: '12:15', kcal: 480, p: 32, c: 58, f: 12 },
    { name: 'Greek yogurt', type: 'snack', time: '15:50', kcal: 180, p: 17, c: 12, f: 6 },
    { name: 'Cá kho & rice', type: 'dinner', time: '19:15', kcal: 620, p: 36, c: 70, f: 20 },
  ],
  [
    { name: 'Oats & peanut butter', type: 'breakfast', time: '08:20', kcal: 520, p: 24, c: 64, f: 20 },
    { name: 'Cơm gà', type: 'lunch', time: '12:30', kcal: 650, p: 40, c: 78, f: 18 },
  ],
];

/** `+07:00`-style offset of the device timezone on a given local date. */
function offsetFor(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const mins = -new Date(y, m - 1, d, 12).getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

let seq = 0;
export function toSavedMeal(date: LocalDate, s: MealSeed): SavedMeal {
  seq += 1;
  return {
    kind: 'saved',
    id: `meal_${date}_${seq}`,
    displayName: s.name,
    mealType: s.type,
    eatenAt: `${date}T${s.time}:00${offsetFor(date)}`,
    localDate: date,
    kcal: s.kcal,
    kcalLow: Math.round(s.kcal * 0.9),
    kcalHigh: Math.round(s.kcal * 1.1),
    proteinG: s.p,
    carbsG: s.c,
    fatG: s.f,
    mode: 'auto',
    confidence: 'medium',
    revision: 1,
  };
}

export type MockScenario = 'inProgress' | 'emptyDay' | 'overTarget' | 'newUser' | 'noTarget';

export const MOCK_SCENARIOS: { id: MockScenario; label: string; note: string }[] = [
  { id: 'inProgress', label: 'Day in progress', note: 'H2 · two saved meals today' },
  { id: 'emptyDay', label: 'Empty day', note: 'H1 · nothing logged today, history exists' },
  { id: 'overTarget', label: 'Over target', note: 'Today exceeds the calorie target' },
  { id: 'newUser', label: 'New user', note: 'First day after onboarding, no history' },
  { id: 'noTarget', label: 'No target', note: 'Under-18 path without manual targets' },
];

/** Build the diary for a scenario, keyed by local date. */
export function buildDiary(scenario: MockScenario, today: LocalDate): Map<LocalDate, SavedMeal[]> {
  const diary = new Map<LocalDate, SavedMeal[]>();
  if (scenario === 'newUser') return diary;

  lastNDays(addDays(today, -1), PAST_SEEDS.length).forEach((date, i) => {
    diary.set(date, PAST_SEEDS[i]!.map((s) => toSavedMeal(date, s)));
  });

  const todaySeeds =
    scenario === 'emptyDay'
      ? []
      : scenario === 'overTarget'
        ? [...TODAY_SEEDS, ...OVER_TARGET_EXTRA]
        : TODAY_SEEDS;
  diary.set(today, todaySeeds.map((s) => toSavedMeal(today, s)));
  return diary;
}
