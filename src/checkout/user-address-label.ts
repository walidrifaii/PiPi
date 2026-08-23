import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type AddressLabelClient = {
  userAddress: {
    findFirst: (args: {
      where: Prisma.UserAddressWhereInput;
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export function normalizeAddressLabel(
  label?: string | null,
): string | null {
  if (label == null) {
    return null;
  }
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function assertUniqueAddressLabelForUser(
  db: AddressLabelClient,
  params: { userId: string; label: string | null; excludeId?: string },
): Promise<void> {
  if (!params.label) {
    return;
  }
  const existing = await db.userAddress.findFirst({
    where: {
      userId: params.userId,
      label: { equals: params.label, mode: 'insensitive' },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new BadRequestException(
      `You already have an address named "${params.label}". Choose a different name.`,
    );
  }
}
