import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { phoneMatchVariants, toE164Phone } from './phone-e164';

/** Phone must not exist on users or drivers (registration / phone change). */
export async function assertPhoneAvailableAcrossUserAndDriver(
  prisma: PrismaService,
  phone: string,
): Promise<void> {
  let variants: string[];
  try {
    variants = phoneMatchVariants(phone);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid phone number';
    throw new BadRequestException(message);
  }

  const [user, driver] = await Promise.all([
    prisma.user.findFirst({
      where: { phone: { in: variants } },
      select: { id: true },
    }),
    prisma.driver.findFirst({
      where: { phone: { in: variants } },
      select: { id: true },
    }),
  ]);

  if (user || driver) {
    throw new BadRequestException(
      'This phone number is already registered. Sign in or use a different number.',
    );
  }
}

/** Canonical E.164 for storage (strips Lebanon +9610 trunk zero). */
export function normalizePhoneForStorage(phone: string): string {
  try {
    return toE164Phone(phone);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid phone number';
    throw new BadRequestException(message);
  }
}
