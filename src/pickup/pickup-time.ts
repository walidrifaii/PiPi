import {
  parseIsoWeekdayFromInput,
  parseLocalTimeToMinutes,
} from '../common/merchant-open-status';
import { PICKUP_WEEKDAY_NAMES } from './pickup.constants';

const SHORT_WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type ZonedClock = {
  weekday: number;
  minutes: number;
  dateKey: string;
};

export function getZonedClock(date: Date, timeZone: string): ZonedClock | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value;
    const wd = get('weekday');
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    if (!wd || !year || !month || !day || hour === undefined || minute === undefined) {
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
    return { weekday, minutes, dateKey: `${year}-${month}-${day}` };
  } catch {
    return null;
  }
}

export function slotContainsMinutes(
  startLocal: string,
  endLocal: string,
  minutes: number,
): boolean {
  const start = parseLocalTimeToMinutes(startLocal);
  const end = parseLocalTimeToMinutes(endLocal);
  if (start === null || end === null || end <= start) {
    return false;
  }
  return minutes >= start && minutes <= end;
}

export function weekdayLabel(weekday: number): string {
  return PICKUP_WEEKDAY_NAMES[weekday] ?? `Day ${weekday}`;
}

export function parseWeekdayOrNull(value: unknown): number | null {
  return parseIsoWeekdayFromInput(value);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoWeekdayForDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const js = utc.getUTCDay();
  return js === 0 ? 7 : js;
}
