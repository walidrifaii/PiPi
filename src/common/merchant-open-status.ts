import { BadRequestException } from '@nestjs/common';

/** ISO weekday: 1 = Monday … 7 = Sunday */
export type MerchantWorkingHoursDay = {
  weekday: number;
  intervals: Array<{ open: string; close: string }>;
};

export type MerchantWorkingHoursWeek = {
  days: MerchantWorkingHoursDay[];
};

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

function parseHm(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
  if (!m) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h * 60 + min;
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
  const day = week.days.find((d) => d.weekday === local.weekday);
  if (!day || day.intervals.length === 0) {
    return false;
  }
  const m = local.minutes;
  for (const intv of day.intervals) {
    const o = parseHm(intv.open);
    const c = parseHm(intv.close);
    if (o === null || c === null) {
      continue;
    }
    if (c > o) {
      if (m >= o && m < c) {
        return true;
      }
    } else if (c < o) {
      if (m >= o || m < c) {
        return true;
      }
    }
  }
  return false;
}

export function parseWorkingHoursJson(
  value: unknown,
): MerchantWorkingHoursWeek | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const daysRaw = (value as { days?: unknown }).days;
  if (!Array.isArray(daysRaw) || daysRaw.length === 0) {
    return null;
  }
  const days: MerchantWorkingHoursDay[] = [];
  for (const d of daysRaw) {
    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      return null;
    }
    const weekday = (d as { weekday?: unknown }).weekday;
    const intervalsRaw = (d as { intervals?: unknown }).intervals;
    if (
      typeof weekday !== 'number' ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    ) {
      return null;
    }
    if (!Array.isArray(intervalsRaw)) {
      return null;
    }
    const intervals: Array<{ open: string; close: string }> = [];
    for (const intv of intervalsRaw) {
      if (typeof intv !== 'object' || intv === null) {
        return null;
      }
      const open = (intv as { open?: unknown }).open;
      const close = (intv as { close?: unknown }).close;
      if (typeof open !== 'string' || typeof close !== 'string') {
        return null;
      }
      if (parseHm(open) === null || parseHm(close) === null) {
        return null;
      }
      intervals.push({ open: open.trim(), close: close.trim() });
    }
    days.push({ weekday, intervals });
  }
  return { days };
}

export function normalizeWorkingHoursWeek(
  week: MerchantWorkingHoursWeek,
): MerchantWorkingHoursWeek {
  const sorted = [...week.days].sort((a, b) => a.weekday - b.weekday);
  return {
    days: sorted.map((d) => ({
      weekday: d.weekday,
      intervals: d.intervals.map((i) => ({
        open: i.open.trim(),
        close: i.close.trim(),
      })),
    })),
  };
}

export function validateWorkingHoursForEnabled(
  timezone: string | undefined,
  week: MerchantWorkingHoursWeek | null,
): { timezone: string; workingHoursJson: object } {
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
      'days with intervals are required when useWorkingHours is true',
    );
  }
  for (const d of week.days) {
    if (d.intervals.length === 0) {
      throw new BadRequestException(
        `weekday ${d.weekday} must have at least one interval`,
      );
    }
  }
  return {
    timezone: tz,
    workingHoursJson: normalizeWorkingHoursWeek(week) as object,
  };
}

export function computeMerchantOpenNow(input: {
  isActive: boolean;
  useWorkingHours: boolean;
  timezone: string | null;
  workingHoursJson: unknown;
  now?: Date;
}): boolean {
  const { isActive, useWorkingHours, timezone, workingHoursJson } = input;
  if (!isActive) {
    return false;
  }
  if (!useWorkingHours) {
    return true;
  }
  if (!timezone || !isValidIanaTimeZone(timezone)) {
    return true;
  }
  const week = parseWorkingHoursJson(workingHoursJson);
  if (!week || week.days.length === 0) {
    return true;
  }
  return isWithinWorkingHours(timezone, week, input.now);
}
