import { mapTextFields } from './localized-text';
import type { I18nOptions } from './locale.types';
import type { ProductOptionGroupView } from '../../merchant/product-option.types';

type BilingualRow = {
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
};

type TitleRow = {
  title?: string | null;
  titleAr?: string | null;
};

export function localizeOptionChoice<
  T extends { name: string; nameAr?: string | null },
>(choice: T, i18n?: I18nOptions) {
  return {
    ...choice,
    ...mapTextFields(choice.name, choice.nameAr, 'name', i18n),
    ...(i18n?.locale ? { nameAr: undefined } : {}),
  };
}

export function localizeOptionGroup(
  group: ProductOptionGroupView,
  i18n?: I18nOptions,
): ProductOptionGroupView {
  const localized = {
    ...group,
    ...mapTextFields(group.name, group.nameAr, 'name', i18n),
    choices: group.choices.map((c) => localizeOptionChoice(c, i18n)),
  };
  if (i18n?.locale) {
    delete (localized as { nameAr?: string | null }).nameAr;
  }
  return localized;
}

export function localizeCategory<T extends BilingualRow & Record<string, unknown>>(
  row: T,
  i18n?: I18nOptions,
) {
  const localized = {
    ...row,
    ...mapTextFields(row.name, row.nameAr, 'name', i18n),
    ...mapTextFields(row.description, row.descriptionAr, 'description', i18n),
  };
  if (i18n?.locale) {
    delete (localized as { nameAr?: string | null }).nameAr;
    delete (localized as { descriptionAr?: string | null }).descriptionAr;
  }
  return localized;
}

export function localizeProduct<
  T extends BilingualRow & {
    optionGroups?: ProductOptionGroupView[];
    category?: (BilingualRow & Record<string, unknown>) | string;
    categoryAr?: string | null;
    merchant?: BilingualRow & Record<string, unknown>;
  },
>(row: T, i18n?: I18nOptions) {
  const localized = {
    ...row,
    ...mapTextFields(row.name, row.nameAr, 'name', i18n),
    ...mapTextFields(row.description, row.descriptionAr, 'description', i18n),
  };

  if (typeof row.category === 'object' && row.category !== null) {
    localized.category = localizeCategory(row.category, i18n);
  } else if (typeof row.category === 'string') {
    const categoryFields = mapTextFields(
      row.category,
      row.categoryAr,
      'name',
      i18n,
    );
    if (i18n?.locale) {
      (localized as { category: string }).category = categoryFields.name ?? '';
      delete (localized as { categoryAr?: string | null }).categoryAr;
    } else {
      (localized as { category: string }).category = row.category;
      (localized as { categoryAr?: string | null }).categoryAr =
        row.categoryAr ?? null;
    }
  }

  if (row.merchant) {
    localized.merchant = localizeMerchant(row.merchant, i18n);
  }

  if (row.optionGroups) {
    localized.optionGroups = row.optionGroups.map((g) =>
      localizeOptionGroup(g, i18n),
    );
  }

  if (i18n?.locale) {
    delete (localized as { nameAr?: string | null }).nameAr;
    delete (localized as { descriptionAr?: string | null }).descriptionAr;
  }

  return localized;
}

export function localizeMerchant<
  T extends BilingualRow & Record<string, unknown>,
>(row: T, i18n?: I18nOptions) {
  const localized = {
    ...row,
    ...mapTextFields(row.name, row.nameAr, 'name', i18n),
  };
  if (i18n?.locale) {
    delete (localized as { nameAr?: string | null }).nameAr;
  }
  return localized;
}

export function localizeOffer<T extends TitleRow & Record<string, unknown>>(
  row: T,
  i18n?: I18nOptions,
) {
  const localized = {
    ...row,
    ...mapTextFields(row.title, row.titleAr, 'title', i18n),
  } as T & Record<string, unknown>;
  if (i18n?.locale) {
    delete (localized as { titleAr?: string | null }).titleAr;
  }
  if (row.merchant && typeof row.merchant === 'object') {
    (localized as unknown as { merchant: unknown }).merchant = localizeMerchant(
      row.merchant as BilingualRow & Record<string, unknown>,
      i18n,
    );
  }
  return localized;
}

export function localizeBanner<T extends TitleRow & Record<string, unknown>>(
  row: T,
  i18n?: I18nOptions,
) {
  const localized = {
    ...row,
    ...mapTextFields(row.title, row.titleAr, 'title', i18n),
  };
  if (i18n?.locale) {
    delete (localized as { titleAr?: string | null }).titleAr;
  }
  return localized;
}

/** Notification inbox row: title + message fields. */
export function localizeNotification<
  T extends TitleRow & {
    message?: string | null;
    messageAr?: string | null;
  } & Record<string, unknown>,
>(row: T, i18n?: I18nOptions) {
  const localized = {
    ...row,
    ...mapTextFields(row.title, row.titleAr, 'title', i18n),
    ...mapTextFields(row.message, row.messageAr, 'message', i18n),
  };
  if (i18n?.locale) {
    delete (localized as { titleAr?: string | null }).titleAr;
    delete (localized as { messageAr?: string | null }).messageAr;
  }
  return localized;
}

export function localizeMerchantType<
  T extends BilingualRow & Record<string, unknown>,
>(row: T, i18n?: I18nOptions) {
  return localizeCategory(row, i18n);
}

/** Attach `locale` to paginated storefront responses when localized. */
export function withLocaleMeta<T extends { items: unknown[] }>(
  response: T,
  i18n?: I18nOptions,
): T & { locale?: string } {
  if (!i18n?.locale) {
    return response;
  }
  return { ...response, locale: i18n.locale };
}

export function withLocaleValue<T extends Record<string, unknown>>(
  value: T,
  i18n?: I18nOptions,
): T & { locale?: string } {
  if (!i18n?.locale) {
    return value;
  }
  return { ...value, locale: i18n.locale };
}
