import { BadRequestException } from '@nestjs/common';

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

/** Case-insensitive prefix match: "walid" matches "Walid" and "Walidruf", not names that only contain "w" elsewhere. */
export function nameStartsWithFilter(term: string) {
  return { startsWith: term, mode: 'insensitive' as const };
}
