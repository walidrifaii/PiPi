import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USER_ACCOUNT_ROLE } from '../auth/account-roles';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  deletionGraceCutoffDate,
  permanentDeletionAt,
  USER_ACCOUNT_DELETION_GRACE_DAYS,
} from './user-account-deletion';

const userPublicSelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  phone: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserPublic = {
  id: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  phone: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.purgeExpiredAccountDeletions();
  }

  private withUserRole(user: UserPublic) {
    return { ...user, role: USER_ACCOUNT_ROLE };
  }

  async findAll() {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userPublicSelect,
    });
    return rows.map((u) => this.withUserRole(u));
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }
    return this.withUserRole(user);
  }

  /**
   * Soft-delete: deactivate account and start the grace period.
   * Sign in again within {@link USER_ACCOUNT_DELETION_GRACE_DAYS} days to restore.
   */
  async requestAccountDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, deletionRequestedAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isActive && !user.deletionRequestedAt) {
      throw new ForbiddenException('Account is inactive');
    }

    if (user.deletionRequestedAt) {
      const permanentAt = permanentDeletionAt(user.deletionRequestedAt);
      return {
        message:
          'Account is already scheduled for deletion. Sign in before the grace period ends to restore it.',
        deletionRequestedAt: user.deletionRequestedAt,
        permanentDeletionAt: permanentAt,
        gracePeriodDays: USER_ACCOUNT_DELETION_GRACE_DAYS,
      };
    }

    const deletionRequestedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletionRequestedAt,
        fcmToken: null,
      },
    });

    return {
      message: `Account deactivated. Sign in within ${USER_ACCOUNT_DELETION_GRACE_DAYS} days to restore it, or it will be permanently deleted.`,
      deletionRequestedAt,
      permanentDeletionAt: permanentDeletionAt(deletionRequestedAt),
      gracePeriodDays: USER_ACCOUNT_DELETION_GRACE_DAYS,
    };
  }

  /** Restore account after the customer signs in during the grace period. */
  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, deletionRequestedAt: { not: null } },
      data: { isActive: true, deletionRequestedAt: null },
    });
  }

  /** Permanently remove users whose deletion grace period has ended. */
  async purgeExpiredAccountDeletions(): Promise<number> {
    const cutoff = deletionGraceCutoffDate();
    const expired = await this.prisma.user.findMany({
      where: {
        deletionRequestedAt: { not: null, lte: cutoff },
      },
      select: { id: true },
    });
    for (const { id } of expired) {
      await this.hardDeleteUser(id);
    }
    return expired.length;
  }

  private async hardDeleteUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { userId },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.order.deleteMany({ where: { userId } });
      }
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private async assertUniquePhoneEmail(
    phone: string | undefined,
    email: string | null | undefined,
    excludeUserId?: string,
  ) {
    if (phone === undefined && email === undefined) {
      return;
    }
    const or: { phone?: string; email?: string }[] = [];
    if (phone !== undefined) {
      or.push({ phone });
    }
    if (email !== undefined && email !== null && email !== '') {
      or.push({ email });
    }
    if (or.length === 0) {
      return;
    }

    if (phone !== undefined) {
      const driverWithPhone = await this.prisma.driver.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (driverWithPhone) {
        throw new BadRequestException(
          'This phone number is already registered. Sign in or use a different number.',
        );
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        AND: [
          { OR: or },
          ...(excludeUserId ? [{ id: { not: excludeUserId } }] : []),
        ],
      },
      select: { id: true, phone: true, email: true },
    });
    if (existing) {
      throw new BadRequestException('Phone or email already in use');
    }
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }
    if (!current.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    await this.assertUniquePhoneEmail(dto.phone, dto.email, userId);

    const data: {
      fullName?: string | null;
      phone?: string;
      email?: string | null;
      passwordHash?: string;
    } = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: userPublicSelect,
      });
      return this.withUserRole(updated);
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async updateByAdmin(userId: string, dto: UpdateUserAdminDto) {
    await this.assertUniquePhoneEmail(dto.phone, dto.email, userId);

    const data: {
      fullName?: string | null;
      phone?: string;
      email?: string | null;
      passwordHash?: string;
      isActive?: boolean;
    } = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: userPublicSelect,
      });
      return this.withUserRole(updated);
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  /** Hard-delete customer and related orders/addresses (super admin only). */
  async deleteByAdmin(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.hardDeleteUser(userId);
    return { message: 'User deleted' };
  }
}
