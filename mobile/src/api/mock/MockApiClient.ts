import type { ApiClient } from '@/api/client';
import { addDays, toLocalDate } from '@/domain/dates';
import { sumSavedMeals } from '@/domain/progress';
import type { DaySummary, DayTarget, DayTotalsSummary, LocalDate, Me, SavedMeal } from '@/domain/types';

import { buildDiary, FIXTURE_PROFILE, FIXTURE_TARGET, type MockScenario } from './fixtures';

export type MockApiOptions = {
  scenario?: MockScenario;
  /** Simulated network latency in ms (0 in tests). */
  latencyMs?: number;
  /** Clock, injectable for tests. */
  now?: () => Date;
};

const NO_TARGET: DayTarget = { source: 'none', values: null, formulaVersion: null, changedToday: false };

/**
 * In-memory implementation of {@link ApiClient}. Behaves like the server contract:
 * day totals are computed from saved meals only, and each day carries its own target
 * snapshot.
 */
export class MockApiClient implements ApiClient {
  private scenario: MockScenario;
  private diary: Map<LocalDate, SavedMeal[]>;
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(opts: MockApiOptions = {}) {
    this.scenario = opts.scenario ?? 'inProgress';
    this.latencyMs = opts.latencyMs ?? 250;
    this.now = opts.now ?? (() => new Date());
    this.diary = buildDiary(this.scenario, this.today());
  }

  get currentScenario(): MockScenario {
    return this.scenario;
  }

  /** Dev tool: switch the mock dataset (Profile → Developer). */
  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
    this.diary = buildDiary(scenario, this.today());
  }

  private today(): LocalDate {
    return toLocalDate(this.now());
  }

  private delay<T>(value: T): Promise<T> {
    if (this.latencyMs <= 0) return Promise.resolve(value);
    return new Promise((resolve) => setTimeout(() => resolve(value), this.latencyMs));
  }

  private targetFor(_date: LocalDate): DayTarget {
    return this.scenario === 'noTarget' ? NO_TARGET : FIXTURE_TARGET;
  }

  private mealsFor(date: LocalDate): SavedMeal[] {
    return [...(this.diary.get(date) ?? [])].sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
  }

  getMe(): Promise<Me> {
    return this.delay({
      profile: { ...FIXTURE_PROFILE, isNewUser: this.scenario === 'newUser' },
    });
  }

  getDay(localDate: LocalDate): Promise<DaySummary> {
    const meals = this.mealsFor(localDate);
    return this.delay({
      localDate,
      meals,
      totals: sumSavedMeals(meals),
      target: this.targetFor(localDate),
    });
  }

  getDays(from: LocalDate, to: LocalDate): Promise<DayTotalsSummary[]> {
    const out: DayTotalsSummary[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const meals = this.mealsFor(d);
      out.push({ localDate: d, totals: sumSavedMeals(meals), mealCount: meals.length, target: this.targetFor(d) });
      if (out.length > 31) break;
    }
    return this.delay(out);
  }
}
