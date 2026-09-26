import {
  addDays,
  addMonths,
  calendarQuarter,
  daysBetween,
  inClosed,
  inHalfOpen,
  inNextDays,
  isISODate,
  localISODate,
} from '@/domain';

describe('calendar dates', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  test('DST change: counts are calendar days, not 24-hour blocks', () => {
    process.env.TZ = 'America/Denver'; // clocks go back on Nov 1, 2026 and forward on Mar 8, 2026
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    // 1:30 AM happens twice on Nov 1; it's still Nov 1 either way.
    expect(localISODate(new Date(2026, 10, 1, 1, 30))).toBe('2026-11-01');
    expect(localISODate(new Date(2026, 2, 8, 3, 30))).toBe('2026-03-08');
  });

  test('crossing a year and a leap day', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-10-13', '2026-09-23')).toBe(-20);
  });

  test('addMonths clamps to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });

  test('windows: half-open for ATS, inclusive for "next N days"', () => {
    expect(inHalfOpen('2026-10-13', '2026-09-23', '2026-10-13')).toBe(false);
    expect(inHalfOpen('2026-10-12', '2026-09-23', '2026-10-13')).toBe(true);
    expect(inClosed('2026-10-13', '2026-09-23', '2026-10-13')).toBe(true);
    expect(inNextDays('2026-09-30', '2026-09-23', 7)).toBe(true);
    expect(inNextDays('2026-10-01', '2026-09-23', 7)).toBe(false);
    expect(inNextDays(undefined, '2026-09-23', 7)).toBe(false);
  });

  test('calendar quarter', () => {
    expect(calendarQuarter('2026-09-23')).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(calendarQuarter('2026-12-31')).toEqual({ start: '2026-10-01', end: '2026-12-31' });
  });

  test('validates real calendar dates', () => {
    expect(isISODate('2026-09-23')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-9-23')).toBe(false);
    expect(() => addDays('Sep 23', 1)).toThrow('Not a calendar date');
  });
});
