import { BadRequestException } from '@nestjs/common';
import type { AppLocale } from './i18n/locale.types';

/** Minimum characters so a query like "w" does not match every name containing that letter. */
export const MIN_NAME_SEARCH_LENGTH = 2;

export function normalizeNameSearchTerm(raw: string): string {
  const term = raw.trim();
  if (term.length === 0) {
    throw new BadRequestException('name is required');
  }
  if (term.length < MIN_NAME_SEARCH_LENGTH) {
    throw new BadRequestException(
      `name must be at least ${MIN_NAME_SEARCH_LENGTH} characters`,
    );
  }
  if (term.length > 100) {
    throw new BadRequestException('name must be at most 100 characters');
  }
  return term;
}

/** Case-insensitive substring match: "burger" matches "Cheese Burger" and "Extra Burger". */
export function nameContainsFilter(term: string) {
  return { contains: term, mode: 'insensitive' as const };
}

/**
 * Locale-aware name search:
 * - `ar` → Arabic `nameAr` only
 * - `en` → English `name` only
 * - no locale → both fields (bilingual response mode)
 */
export function buildNameSearchWhere(term: string, locale?: AppLocale) {
  if (locale === 'ar') {
    return { nameAr: nameContainsFilter(term) };
  }
  if (locale === 'en') {
    return { name: nameContainsFilter(term) };
  }
  return {
    OR: [
      { name: nameContainsFilter(term) },
      { nameAr: nameContainsFilter(term) },
    ],
  };
}
