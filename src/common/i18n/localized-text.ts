import { type AppLocale, type I18nOptions } from './locale.types';

/** Pick the best string for a locale with cross-locale fallback. */
export function pickLocalized(
  en: string | null | undefined,
  ar: string | null | undefined,
  locale: AppLocale,
): string | null {
  const enVal = en?.trim() ? en.trim() : null;
  const arVal = ar?.trim() ? ar.trim() : null;
  if (locale === 'ar') {
    return arVal ?? enVal;
  }
  return enVal ?? arVal;
}

type TextFieldKey = 'name' | 'description' | 'title' | 'message';

/** Map DB bilingual columns to API fields (localized or bilingual). */
export function mapTextFields(
  en: string | null | undefined,
  ar: string | null | undefined,
  field: TextFieldKey,
  i18n?: I18nOptions,
): Record<string, string | null> {
  if (!i18n?.locale) {
    if (field === 'title') {
      return { title: en ?? null, titleAr: ar ?? null };
    }
    if (field === 'message') {
      return { message: en ?? null, messageAr: ar ?? null };
    }
    return {
      [field]: en ?? null,
      [`${field}Ar`]: ar ?? null,
    };
  }
  const value = pickLocalized(en, ar, i18n.locale);
  return { [field]: value };
}
