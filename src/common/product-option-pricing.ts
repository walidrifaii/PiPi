import { BadRequestException } from '@nestjs/common';
import { resolveEffectiveUnitPrice } from './product-pricing';
import type { SelectedOptionSnapshot } from '../merchant/product-option.types';

type OptionChoiceRow = {
  id: string;
  name: string;
  nameAr: string | null;
  priceModifier: { toString(): string };
  sortOrder: number;
  isActive: boolean;
};

type OptionGroupRow = {
  id: string;
  name: string;
  nameAr: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  choices: OptionChoiceRow[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum of active choice modifiers for validated selections. */
export function resolveUnitPriceWithOptions(
  listPrice: number,
  discountPrice: number | null | undefined,
  modifiers: number[],
): number {
  const base = resolveEffectiveUnitPrice(listPrice, discountPrice);
  const extra = modifiers.reduce((sum, m) => sum + Number(m), 0);
  return roundMoney(base + extra);
}

/**
 * Validates `selectedChoiceIds` against product option groups and returns
 * snapshot rows plus total modifier sum.
 */
export function validateProductOptionSelections(
  groups: OptionGroupRow[],
  selectedChoiceIds: string[] | undefined,
): { selected: SelectedOptionSnapshot[]; modifierTotal: number } {
  const ids = selectedChoiceIds ?? [];
  const uniqueIds = [...new Set(ids)];

  if (groups.length === 0) {
    if (uniqueIds.length > 0) {
      throw new BadRequestException('Product has no options');
    }
    return { selected: [], modifierTotal: 0 };
  }

  const choiceById = new Map<string, OptionChoiceRow & { group: OptionGroupRow }>();
  for (const group of groups) {
    for (const choice of group.choices) {
      if (!choice.isActive) {
        continue;
      }
      choiceById.set(choice.id, { ...choice, group });
    }
  }

  for (const choiceId of uniqueIds) {
    if (!choiceById.has(choiceId)) {
      throw new BadRequestException(
        `Invalid or inactive option choice: ${choiceId}`,
      );
    }
  }

  const selectedByGroup = new Map<string, string[]>();
  for (const choiceId of uniqueIds) {
    const row = choiceById.get(choiceId)!;
    const list = selectedByGroup.get(row.group.id) ?? [];
    list.push(choiceId);
    selectedByGroup.set(row.group.id, list);
  }

  const selected: SelectedOptionSnapshot[] = [];
  let modifierTotal = 0;

  for (const group of groups) {
    const picked = selectedByGroup.get(group.id) ?? [];
    const count = picked.length;

    if (group.isRequired && count < group.minSelect) {
      throw new BadRequestException(
        `Option "${group.name}" requires at least ${group.minSelect} selection(s)`,
      );
    }
    if (count > group.maxSelect) {
      throw new BadRequestException(
        `Option "${group.name}" allows at most ${group.maxSelect} selection(s)`,
      );
    }
    if (!group.isRequired && count === 0) {
      continue;
    }
    if (count < group.minSelect || count > group.maxSelect) {
      throw new BadRequestException(
        `Option "${group.name}" requires between ${group.minSelect} and ${group.maxSelect} selection(s)`,
      );
    }

    for (const choiceId of picked) {
      const choice = choiceById.get(choiceId)!;
      const mod = Number(choice.priceModifier);
      modifierTotal += mod;
      selected.push({
        groupId: group.id,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceModifier: mod,
      });
    }
  }

  return { selected, modifierTotal: roundMoney(modifierTotal) };
}

export function formatProductNameWithOptions(
  baseName: string,
  selected: SelectedOptionSnapshot[],
): string {
  if (selected.length === 0) {
    return baseName;
  }
  const suffix = selected.map((s) => s.choiceName).join(', ');
  const combined = `${baseName} (${suffix})`;
  return combined.length > 255 ? combined.slice(0, 255) : combined;
}
