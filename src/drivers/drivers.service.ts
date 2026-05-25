import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DRIVER_ACCOUNT_ROLE } from '../auth/account-roles';
import { assertPhoneAvailableAcrossUserAndDriver } from '../common/phone-account-uniqueness';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDriverDto } from '../auth/dto/register-driver.dto';
import { UpdateDriverAdminDto } from './dto/update-driver-admin.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

const driverPublicSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  vehicleType: true,
  status: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DriverPublic = {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  vehicleType: string | null;
  status: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  private withDriverRole(driver: DriverPublic) {
    return { ...driver, role: DRIVER_ACCOUNT_ROLE };
  }

  async findAll() {
    const rows = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      select: driverPublicSelect,
    });
    return rows.map((d) => this.withDriverRole(d));
  }

  /** Super admin: create a driver account (driver signs in with the given password). */
  async createByAdmin(dto: RegisterDriverDto) {
    const platformAdmins = await this.prisma.superAdmin.count({
      where: { isActive: true },
    });
    if (platformAdmins === 0) {
      throw new ForbiddenException(
        'Create an active platform super admin before adding drivers.',
      );
    }

    await assertPhoneAvailableAcrossUserAndDriver(this.prisma, dto.phone);

    if (dto.email) {
      const existingEmail = await this.prisma.driver.findFirst({
        where: { email: dto.email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new BadRequestException(
          'A driver with this email already exists',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const driver = await this.prisma.driver.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        vehicleType: dto.vehicleType,
        status: dto.status,
      },
      select: driverPublicSelect,
    });
    return { driver: this.withDriverRole(driver) };
  }

  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: driverPublicSelect,
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return this.withDriverRole(driver);
  }

  private async assertUniquePhoneEmail(
    phone: string | undefined,
    email: string | null | undefined,
    excludeDriverId?: string,
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
      const userWithPhone = await this.prisma.user.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (userWithPhone) {
        throw new BadRequestException(
          'This phone number is already registered. Sign in or use a different number.',
        );
      }
    }

    const existing = await this.prisma.driver.findFirst({
      where: {
        AND: [
          { OR: or },
          ...(excludeDriverId ? [{ id: { not: excludeDriverId } }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Phone or email already in use');
    }
  }

  async updateProfile(driverId: string, dto: UpdateDriverDto) {
    await this.assertUniquePhoneEmail(dto.phone, dto.email, driverId);

    const data: {
      fullName?: string | null;
      phone?: string;
      email?: string | null;
      passwordHash?: string;
      vehicleType?: string | null;
      status?: string | null;
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
    if (dto.vehicleType !== undefined) {
      data.vehicleType = dto.vehicleType;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(driverId);
    }

    try {
      const updated = await this.prisma.driver.update({
        where: { id: driverId },
        data,
        select: driverPublicSelect,
      });
      return this.withDriverRole(updated);
    } catch {
      throw new NotFoundException('Driver not found');
    }
  }

  async updateByAdmin(driverId: string, dto: UpdateDriverAdminDto) {
    await this.assertUniquePhoneEmail(dto.phone, dto.email, driverId);

    const data: {
      fullName?: string | null;
      phone?: string;
      email?: string | null;
      passwordHash?: string;
      vehicleType?: string | null;
      status?: string | null;
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
    if (dto.vehicleType !== undefined) {
      data.vehicleType = dto.vehicleType;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(driverId);
    }

    try {
      const updated = await this.prisma.driver.update({
        where: { id: driverId },
        data,
        select: driverPublicSelect,
      });
      return this.withDriverRole(updated);
    } catch {
      throw new NotFoundException('Driver not found');
    }
  }
}
