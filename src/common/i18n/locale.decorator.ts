import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveI18nOptions } from './resolve-locale';
import type { I18nOptions } from './locale.types';

/**
 * Resolves `?lang=ar|en` or `Accept-Language` for storefront endpoints.
 * Omit `lang` to receive bilingual fields (`name` + `nameAr`).
 */
export const I18n = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): I18nOptions => {
    const req = ctx.switchToHttp().getRequest<{
      query?: { lang?: string };
      headers?: { 'accept-language'?: string };
    }>();
    const lang = req.query?.lang;
    const acceptLanguage = req.headers?.['accept-language'];
    return resolveI18nOptions(
      typeof lang === 'string' ? lang : undefined,
      typeof acceptLanguage === 'string' ? acceptLanguage : undefined,
    );
  },
);
