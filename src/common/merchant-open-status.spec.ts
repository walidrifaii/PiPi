import {
  buildDailyOperatingWeek,
  computePlatformOpenNow,
  intervalMatchesLocalTime,
  isWithinWorkingHours,
} from './merchant-open-status';

describe('intervalMatchesLocalTime (9 AM → 1 AM next day)', () => {
  const open = 9 * 60;
  const close = 1 * 60;
  const monday = 1;
  const tuesday = 2;

  it('is open Monday 10:00', () => {
    expect(
      intervalMatchesLocalTime(tuesday, 10 * 60, monday, open, close),
    ).toBe(false);
    expect(
      intervalMatchesLocalTime(monday, 10 * 60, monday, open, close),
    ).toBe(true);
  });

  it('is closed Monday 08:00 (before open, same day)', () => {
    expect(
      intervalMatchesLocalTime(monday, 8 * 60, monday, open, close),
    ).toBe(false);
  });

  it('is closed Monday 00:30 (early morning is not open yet)', () => {
    expect(
      intervalMatchesLocalTime(monday, 30, monday, open, close),
    ).toBe(false);
  });

  it('is open Tuesday 00:30 (spillover from Monday interval)', () => {
    expect(
      intervalMatchesLocalTime(tuesday, 30, monday, open, close),
    ).toBe(true);
  });

  it('is closed Tuesday 02:00 (after 1 AM close)', () => {
    expect(
      intervalMatchesLocalTime(tuesday, 2 * 60, monday, open, close),
    ).toBe(false);
  });
});

describe('computePlatformOpenNow', () => {
  const config = {
    timezone: 'Asia/Beirut',
    openLocal: '09:00',
    closeLocal: '01:00',
  };

  it('daily week uses cross-midnight close on every weekday', () => {
    const week = buildDailyOperatingWeek('09:00', '01:00');
    expect(week.days).toHaveLength(7);
    expect(week.days[0]?.intervals[0]).toEqual({
      open: '09:00',
      close: '01:00',
    });
  });

  it('returns boolean for current time', () => {
    expect(typeof computePlatformOpenNow(config)).toBe('boolean');
  });
});

describe('isWithinWorkingHours same-day interval', () => {
  it('supports 09:00-17:00 on Monday only', () => {
    const week = {
      days: [
        {
          weekday: 1,
          intervals: [{ open: '09:00', close: '17:00' }],
        },
      ],
    };
    const mondayNoon = new Date('2026-06-08T09:00:00.000Z');
    expect(isWithinWorkingHours('Asia/Beirut', week, mondayNoon)).toBe(true);
  });
});
