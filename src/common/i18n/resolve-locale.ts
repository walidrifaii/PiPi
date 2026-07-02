import { type AppLocale, type I18nOptions } from './locale.types';

function parseLocaleToken(raw?: string): AppLocale | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const token = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (token === 'ar' || token === 'en') {
    return token;
  }
  return undefined;
}

/** Parse `Accept-Language` and return the first supported locale. */
function parseAcceptLanguage(header?: string): AppLocale | undefined {
  if (!header?.trim()) {
    return undefined;
  }
  for (const part of header.split(',')) {
    const lang = part.split(';')[0]?.trim().toLowerCase().split(/[-_]/)[0];
    if (lang === 'ar' || lang === 'en') {
      return lang;
    }
  }
  return undefined;
}

/**
 * Resolve locale from `?lang=ar|en` (priority) or `Accept-Language` header.
 * Returns `undefined` when no supported locale is requested (bilingual response mode).
 */
export function resolveLocale(
  queryLang?: string,
  acceptLanguage?: string,
): AppLocale | undefined {
  return parseLocaleToken(queryLang) ?? parseAcceptLanguage(acceptLanguage);
}

export function resolveI18nOptions(
  queryLang?: string,
  acceptLanguage?: string,
): I18nOptions {
  const locale = resolveLocale(queryLang, acceptLanguage);
  return locale ? { locale } : {};
}
