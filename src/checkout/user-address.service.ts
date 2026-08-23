import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';
import {
  assertUniqueAddressLabelForUser,
  normalizeAddressLabel,
} from './user-address-label';

function toAddressResponse(row: {
  id: string;
  label: string | null;
  addressLine: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    label: row.label,
    addressLine: row.addressLine,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class UserAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const rows = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map(toAddressResponse);
  }

  async getForUser(userId: string, addressId: string) {
    const row = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!row) {
      throw new NotFoundException('Address not found');
    }
    return toAddressResponse(row);
  }

  async createForUser(userId: string, dto: CreateUserAddressDto) {
    const isDefault = dto.isDefault ?? false;
    const label = normalizeAddressLabel(dto.label);
    return this.prisma.$transaction(async (tx) => {
      await assertUniqueAddressLabelForUser(tx, { userId, label });
      if (isDefault) {
        await tx.userAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      const row = await tx.userAddress.create({
        data: {
          userId,
          label,
          addressLine: dto.addressLine,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault,
        },
      });
      return toAddressResponse(row);
    });
  }

  async updateForUser(
    userId: string,
    addressId: string,
    dto: UpdateUserAddressDto,
  ) {
    await this.getForUser(userId, addressId);
    const isDefault = dto.isDefault;
    const label =
      dto.label !== undefined ? normalizeAddressLabel(dto.label) : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (label !== undefined) {
        await assertUniqueAddressLabelForUser(tx, {
          userId,
          label,
          excludeId: addressId,
        });
      }
      if (isDefault === true) {
        await tx.userAddress.updateMany({
          where: { userId, id: { not: addressId } },
          data: { isDefault: false },
        });
      }
      const row = await tx.userAddress.update({
        where: { id: addressId },
        data: {
          ...(label !== undefined ? { label } : {}),
          ...(dto.addressLine !== undefined
            ? { addressLine: dto.addressLine }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
        },
      });
      return toAddressResponse(row);
    });
  }

  async deleteForUser(userId: string, addressId: string) {
    await this.getForUser(userId, addressId);
    await this.prisma.userAddress.delete({ where: { id: addressId } });
    return { deleted: true };
  }
}
