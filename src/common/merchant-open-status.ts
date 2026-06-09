import { BadRequestException } from '@nestjs/common';

/** ISO weekday: 1 = Monday … 7 = Sunday */
export type MerchantWorkingHoursDay = {
  weekday: number;
  intervals: Array<{ open: string; close: string }>;
};

export type MerchantWorkingHoursWeek = {
  days: MerchantWorkingHoursDay[];
};

export type WorkingIntervalRow = {
  weekday: number;
  openLocal: string;
  closeLocal: string;
  sortOrder: number;
};

/** One row in a fixed Monday–Sunday schedule (for API responses). */
export type WorkingDayScheduleEntry = {
  /** Full English day name, e.g. `Monday`. */
  weekday: string;
  intervals: Array<{ open: string; close: string }>;
};

const ISO_WEEKDAY_DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const DAY_NAME_TO_ISO: ReadonlyMap<string, number> = new Map(
  (
    [
      [['monday', 'mon'], 1],
      [['tuesday', 'tue', 'tues'], 2],
      [['wednesday', 'wed'], 3],
      [['thursday', 'thu', 'thur', 'thurs'], 4],
      [['friday', 'fri'], 5],
      [['saturday', 'sat'], 6],
      [['sunday', 'sun'], 7],
    ] as const
  ).flatMap(([names, n]) => names.map((name) => [name, n] as const)),
);

/**
 * Accepts English full/abbrev day names (case-insensitive), digit strings `"1"`–`"7"`,
 * or integer `1`–`7` for backward compatibility.
 */
export function parseIsoWeekdayFromInput(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  ) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const s = value.trim().toLowerCase();
  if (!s) {
    return null;
  }
  if (/^[1-7]$/.test(s)) {
    return Number(s);
  }
  return DAY_NAME_TO_ISO.get(s) ?? null;
}

/** IANA timezone for Lebanon (Beirut). */
export const MERCHANT_TIMEZONE_LEBANON = 'Asia/Beirut';

/** PipPip default: open 9:00 AM, close 1:00 AM next calendar day. */
export const DEFAULT_PLATFORM_OPEN_LOCAL = '09:00';
export const DEFAULT_PLATFORM_CLOSE_LOCAL = '01:00';

export type PlatformOperatingHours = {
  useOperatingHours: boolean;
  timezone: string;
  openLocal: string;
  closeLocal: string;
};

export type PlatformOperatingStatus = PlatformOperatingHours & {
  isOpenNow: boolean;
};

/**
 * Parses a local time string: 24-hour `HH:mm` / `H:mm`, or 12-hour `h:mm AM` / `h:mm PM` (case-insensitive).
 * Returns minutes from midnight, or null if invalid.
 */
export function parseLocalTimeToMinutes(raw: string): number | null {
  const s = String(raw).trim();
  if (!s) {
    return null;
  }
  const m24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) {
      return null;
    }
    return h * 60 + min;
  }
  const m12 = /^(\d{1,2}):([0-5]\d)\s*([ap]m)$/i.exec(s);
  if (!m12) {
    return null;
  }
  let h = Number(m12[1]);
  const min = Number(m12[2]);
  const ap = m12[3].toUpperCase();
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 1 || h > 12) {
    return null;
  }
  if (ap === 'AM') {
    if (h === 12) {
      h = 0;
    }
  } else {
    if (h !== 12) {
      h += 12;
    }
  }
  return h * 60 + min;
}

function minutesTo24h(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Normalizes a user-supplied local time to `HH:mm` (24h) for storage. */
export function normalizeLocalTimeTo24h(raw: string): string | null {
  const m = parseLocalTimeToMinutes(raw);
  if (m === null) {
    return null;
  }
  return minutesTo24h(m);
}

function formatMinutesToAmPm(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const min = totalMinutes % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) {
    h12 = 12;
  }
  return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}

/** Formats a stored `HH:mm` (24h) string for API display as `h:mm AM/PM`. */
export function format24hToAmPm(hhmm: string): string {
  const m = parseLocalTimeToMinutes(hhmm.trim());
  if (m === null) {
    return hhmm.trim();
  }
  return formatMinutesToAmPm(m);
}

/** Always 7 entries (Mon → Sun). Empty `intervals` means closed that day. Times are `h:mm AM/PM`. */
export function buildFullWeekSchedule(
  week: MerchantWorkingHoursWeek | null,
): WorkingDayScheduleEntry[] {
  const byWeekday = new Map<number, Array<{ open: string; close: string }>>();
  if (week) {
    for (const d of week.days) {
      byWeekday.set(
        d.weekday,
        d.intervals.map((i) => ({
          open: format24hToAmPm(i.open),
          close: format24hToAmPm(i.close),
        })),
      );
    }
  }
  const out: WorkingDayScheduleEntry[] = [];
  for (let w = 1; w <= 7; w++) {
    out.push({
      weekday: ISO_WEEKDAY_DAY_NAMES[w] ?? `Day ${w}`,
      intervals: byWeekday.get(w) ?? [],
    });
  }
  return out;
}

const SHORT_WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isValidIanaTimeZone(tz: string): boolean {
  const z = tz.trim();
  if (!z) {
    return false;
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: z }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getLocalWeekdayAndMinutes(
  date: Date,
  timeZone: string,
): { weekday: number; minutes: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(date);
    const wd = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (!wd || hour === undefined || minute === undefined) {
      return null;
    }
    const weekday = SHORT_WEEKDAY_TO_ISO[wd];
    if (!weekday) {
      return null;
    }
    const minutes = Number(hour) * 60 + Number(minute);
    if (!Number.isFinite(minutes)) {
      return null;
    }
    return { weekday, minutes };
  } catch {
    return null;
  }
}

/** @internal Exported for unit tests. */
export function intervalMatchesLocalTime(
  weekday: number,
  minutes: number,
  intervalWeekday: number,
  openMinutes: number,
  closeMinutes: number,
): boolean {
  if (closeMinutes > openMinutes) {
    if (weekday !== intervalWeekday) {
      return false;
    }
    return minutes >= openMinutes && minutes < closeMinutes;
  }
  if (closeMinutes < openMinutes) {
    const nextWeekday = intervalWeekday === 7 ? 1 : intervalWeekday + 1;
    if (weekday === intervalWeekday && minutes >= openMinutes) {
      return true;
    }
    if (weekday === nextWeekday && minutes < closeMinutes) {
      return true;
    }
    return false;
  }
  return false;
}

export function isWithinWorkingHours(
  timeZone: string,
  week: MerchantWorkingHoursWeek,
  now: Date = new Date(),
): boolean {
  const local = getLocalWeekdayAndMinutes(now, timeZone);
  if (!local) {
    return false;
  }
  const { weekday, minutes } = local;

  for (const day of week.days) {
    for (const intv of day.intervals) {
      const o = parseLocalTimeToMinutes(intv.open);
      const c = parseLocalTimeToMinutes(intv.close);
      if (o === null || c === null) {
        continue;
      }
      if (intervalMatchesLocalTime(weekday, minutes, day.weekday, o, c)) {
        return true;
      }
    }
  }
  return false;
}

/** Daily platform schedule (same hours every day, close may be next morning). */
export function buildDailyOperatingWeek(
  openLocal: string,
  closeLocal: string,
): MerchantWorkingHoursWeek {
  const days: MerchantWorkingHoursDay[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    days.push({
      weekday,
      intervals: [{ open: openLocal, close: closeLocal }],
    });
  }
  return { days };
}

export function computePlatformOpenNow(
  config: Pick<PlatformOperatingHours, 'timezone' | 'openLocal' | 'closeLocal'>,
  now?: Date,
): boolean {
  const week = buildDailyOperatingWeek(config.openLocal, config.closeLocal);
  return isWithinWorkingHours(config.timezone, week, now);
}

/** Build the weekly shape used by `isWithinWorkingHours` from DB interval rows. */
export function workingIntervalsToWeek(
  rows: WorkingIntervalRow[],
): MerchantWorkingHoursWeek {
  const sorted = [...rows].sort((a, b) => {
    if (a.weekday !== b.weekday) {
      return a.weekday - b.weekday;
    }
    return a.sortOrder - b.sortOrder;
  });
  const byDay = new Map<number, Array<{ open: string; close: string }>>();
  for (const r of sorted) {
    const list = byDay.get(r.weekday) ?? [];
    list.push({
      open: r.openLocal.trim(),
      close: r.closeLocal.trim(),
    });
    byDay.set(r.weekday, list);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, intervals]) => ({ weekday, intervals }));
  return { days };
}

export function normalizeWorkingHoursWeek(
  week: MerchantWorkingHoursWeek,
): MerchantWorkingHoursWeek {
  const sorted = [...week.days].sort((a, b) => a.weekday - b.weekday);
  const days = sorted
    .map((d) => ({
      weekday: d.weekday,
      intervals: d.intervals.map((i) => {
        const open = normalizeLocalTimeTo24h(i.open.trim());
        const close = normalizeLocalTimeTo24h(i.close.trim());
        if (open === null || close === null) {
          throw new BadRequestException(
            `Invalid time format for weekday ${d.weekday} (use HH:mm or h:mm AM/PM)`,
          );
        }
        return { open, close };
      }),
    }))
    .filter((d) => d.intervals.length > 0);
  return { days };
}

/**
 * Fills missing ISO weekdays (1–7) with closed days. Duplicate weekdays throw.
 * Used before validation so clients can send only working days or the full week.
 */
export function coerceWeekFromPartialDays(
  days: MerchantWorkingHoursDay[] | undefined,
): MerchantWorkingHoursWeek {
  const byW = new Map<number, MerchantWorkingHoursDay>();
  if (days) {
    const seen = new Set<number>();
    for (const d of days) {
      if (seen.has(d.weekday)) {
        throw new BadRequestException(`Duplicate weekday ${d.weekday}`);
      }
      seen.add(d.weekday);
      byW.set(d.weekday, d);
    }
  }
  const full: MerchantWorkingHoursDay[] = [];
  for (let w = 1; w <= 7; w++) {
    const existing = byW.get(w);
    full.push(existing ?? { weekday: w, intervals: [] });
  }
  return { days: full };
}

export function validateWorkingHoursForEnabled(
  timezone: string | undefined,
  week: MerchantWorkingHoursWeek | null,
): { timezone: string; week: MerchantWorkingHoursWeek } {
  const tz = typeof timezone === 'string' ? timezone.trim() : '';
  if (!tz) {
    throw new BadRequestException(
      'timezone is required when useWorkingHours is true',
    );
  }
  if (!isValidIanaTimeZone(tz)) {
    throw new BadRequestException('timezone must be a valid IANA name');
  }
  if (!week || week.days.length === 0) {
    throw new BadRequestException(
      'days are required when useWorkingHours is true (send all 7 weekdays or a partial list; empty intervals means closed)',
    );
  }
  for (const d of week.days) {
    for (const intv of d.intervals) {
      if (
        parseLocalTimeToMinutes(intv.open) === null ||
        parseLocalTimeToMinutes(intv.close) === null
      ) {
        throw new BadRequestException(
          `Invalid time format for weekday ${d.weekday} (use HH:mm or h:mm AM/PM)`,
        );
      }
    }
  }
  return {
    timezone: tz,
    week: normalizeWorkingHoursWeek(week),
  };
}

export function computeMerchantOpenNow(input: {
  isActive: boolean;
  useWorkingHours: boolean;
  timezone: string | null;
  week: MerchantWorkingHoursWeek | null;
  now?: Date;
}): boolean {
  const { isActive, useWorkingHours, timezone, week } = input;
  if (!isActive) {
    return false;
  }
  if (!useWorkingHours) {
    return true;
  }
  if (!timezone || !isValidIanaTimeZone(timezone)) {
    return true;
  }
  if (!week || week.days.length === 0) {
    return false;
  }
  return isWithinWorkingHours(timezone, week, input.now);
}
