/** Supported customer-facing locales (fixed bilingual app). */
export const SUPPORTED_LOCALES = ['en', 'ar'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

/**
 * When `locale` is set, public APIs return resolved single-value text fields.
 * When omitted, APIs return bilingual columns (`name` + `nameAr`, etc.) for backward compatibility.
 */
export type I18nOptions = {
  locale?: AppLocale;
};

export function isLocalizedResponse(opts?: I18nOptions): opts is { locale: AppLocale } {
  return opts?.locale !== undefined;
}
