import type { LocalDate } from '@/domain/types';

import {
  addDays,
  dayPart,
  formatHeaderDate,
  formatLongDate,
  formatMealTime,
  fromLocalDate,
  lastNDays,
  toLocalDate,
  weekdayShort,
} from '../dates';
import { formatInt, GOAL_LABEL } from '../format';

const d = (s: string) => s as LocalDate;

describe('local dates', () => {
  it('uses the device-local calendar day, not UTC', () => {
    // 23:30 local on 16 Nov must stay 16 Nov regardless of the UTC date.
    expect(toLocalDate(new Date(2026, 10, 16, 23, 30))).toBe('2026-11-16');
    expect(toLocalDate(new Date(2026, 10, 17, 0, 5))).toBe('2026-11-17');
  });

  it('round-trips through fromLocalDate', () => {
    expect(toLocalDate(fromLocalDate(d('2026-03-08')))).toBe('2026-03-08');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(d('2026-11-30'), 1)).toBe('2026-12-01');
    expect(addDays(d('2027-01-01'), -1)).toBe('2026-12-31');
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
  });

  it('builds the 7-day strip ending today, oldest first', () => {
    expect(lastNDays(d('2026-11-16'), 7)).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
  });

  it('formats the Home header and labels', () => {
    expect(formatHeaderDate(d('2026-11-16'))).toBe('Monday, 16 Nov');
    expect(formatLongDate(d('2026-11-16'))).toBe('Monday 16 November');
    expect(weekdayShort(d('2026-11-15'))).toBe('Sun');
  });

  it('keeps the wall-clock time written in a meal timestamp', () => {
    expect(formatMealTime('2026-11-16T12:41:00+07:00')).toBe('12:41');
    expect(formatMealTime('2026-11-16T08:05:00-08:00')).toBe('08:05');
  });

  it.each([
    [4, 'evening'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
  ])('hour %d is %s', (h, part) => {
    expect(dayPart(h)).toBe(part);
  });
});

describe('formatInt', () => {
  it.each([
    [0, '0'],
    [930, '930'],
    [2050, '2,050'],
    [1234567, '1,234,567'],
    [674.6, '675'],
    [-1200, '-1,200'],
  ])('%d → %s', (n, s) => {
    expect(formatInt(n)).toBe(s);
  });
});

describe('goal labels', () => {
  it('covers all five approved goals with design copy', () => {
    expect(Object.values(GOAL_LABEL)).toEqual(['Weight loss', 'Healthy weight gain', 'Muscle bulk', 'Gym cut', 'Maintain']);
  });
});
