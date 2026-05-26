import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProductOptionGroupDto } from './dto/product-option.dto';

/** Parses multipart `optionGroupsJson` and validates nested option DTOs. */
export function parseOptionGroupsJson(
  raw: string | undefined,
): ProductOptionGroupDto[] | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new BadRequestException('optionGroupsJson must be valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new BadRequestException('optionGroupsJson must be a JSON array');
  }

  if (parsed.length === 0) {
    return [];
  }

  const groups: ProductOptionGroupDto[] = [];
  const messages: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const group = plainToInstance(ProductOptionGroupDto, parsed[i], {
      enableImplicitConversion: true,
    });
    const errors = validateSync(group, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      for (const err of errors) {
        messages.push(
          ...Object.values(err.constraints ?? {}),
          ...Object.values(err.children?.[0]?.constraints ?? {}),
        );
      }
    }
    groups.push(group);
  }

  if (messages.length > 0) {
    throw new BadRequestException(messages.join('; '));
  }

  return groups;
}
