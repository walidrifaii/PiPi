import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USER_ACCOUNT_ROLE } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.withUserRole(user);
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

    return { message: 'User deleted' };
  }
}
