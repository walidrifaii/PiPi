import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Phone must not exist on users or drivers (registration / phone change). */
export async function assertPhoneAvailableAcrossUserAndDriver(
  prisma: PrismaService,
  phone: string,
): Promise<void> {
  const [user, driver] = await Promise.all([
    prisma.user.findFirst({ where: { phone }, select: { id: true } }),
    prisma.driver.findFirst({ where: { phone }, select: { id: true } }),
  ]);

  if (user || driver) {
    throw new BadRequestException(
      'This phone number is already registered. Sign in or use a different number.',
    );
  }
}
