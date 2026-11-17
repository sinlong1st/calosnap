import { addDays } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

import { MockApiClient } from '../mock/MockApiClient';

const NOW = () => new Date(2026, 10, 16, 14, 30);
const TODAY = '2026-11-16' as LocalDate;

const client = (scenario?: ConstructorParameters<typeof MockApiClient>[0]) =>
  new MockApiClient({ latencyMs: 0, now: NOW, ...scenario });

describe('MockApiClient', () => {
  it('returns the H2 day: totals derived from saved meals only', async () => {
    const day = await client().getDay(TODAY);
    expect(day.meals.map((m) => m.displayName)).toEqual(['Oats & peanut butter', 'Turkey wrap']);
    expect(day.totals).toEqual({ kcal: 1120, proteinG: 88, carbsG: 120, fatG: 38 });
    expect(day.target.values?.kcal).toBe(2050);
    expect(day.target.formulaVersion).toBe('fixture.design-v1.1');
  });

  it('sorts meals by time', async () => {
    const day = await client({ scenario: 'overTarget' }).getDay(TODAY);
    const times = day.meals.map((m) => m.eatenAt);
    expect(times).toEqual([...times].sort());
    expect(day.totals.kcal).toBeGreaterThan(2050);
  });

  it('empty day has no meals today but keeps history', async () => {
    const c = client({ scenario: 'emptyDay' });
    expect((await c.getDay(TODAY)).meals).toHaveLength(0);
    expect((await c.getDay(addDays(TODAY, -1))).meals.length).toBeGreaterThan(0);
  });

  it('new user has no history and is flagged new', async () => {
    const c = client({ scenario: 'newUser' });
    expect((await c.getMe()).profile.isNewUser).toBe(true);
    const days = await c.getDays(addDays(TODAY, -6), TODAY);
    expect(days.every((d) => d.mealCount === 0)).toBe(true);
  });

  it('no-target scenario returns a "none" target', async () => {
    const day = await client({ scenario: 'noTarget' }).getDay(TODAY);
    expect(day.target).toMatchObject({ source: 'none', values: null });
  });

  it('getDays returns one summary per day, inclusive', async () => {
    const days = await client().getDays(addDays(TODAY, -6), TODAY);
    expect(days.map((d) => d.localDate)).toHaveLength(7);
    expect(days[6]).toMatchObject({ localDate: TODAY, mealCount: 2 });
  });

  it('setScenario switches the dataset', async () => {
    const c = client();
    c.setScenario('emptyDay');
    expect(c.currentScenario).toBe('emptyDay');
    expect((await c.getDay(TODAY)).meals).toHaveLength(0);
  });
});
