import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantTypeDto } from './dto/create-merchant-type.dto';
import { UpdateMerchantTypeDto } from './dto/update-merchant-type.dto';

const publicSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  imageUrl: true,
  sortOrder: true,
} as const;

@Injectable()
export class MerchantTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: S3Service,
  ) {}

  findAllPublic() {
    return this.prisma.merchantType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: publicSelect,
    });
  }

  findAllAdmin() {
    return this.prisma.merchantType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.merchantType.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Merchant type not found');
    }
    return row;
  }

  async create(dto: CreateMerchantTypeDto, imageUrl?: string) {
    try {
      return await this.prisma.merchantType.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          imageUrl,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A merchant type with this code already exists',
        );
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateMerchantTypeDto, imageUrl?: string) {
    const existing = await this.findOne(id);
    try {
      const updated = await this.prisma.merchantType.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      });
      if (
        imageUrl !== undefined &&
        existing.imageUrl &&
        existing.imageUrl !== imageUrl
      ) {
        await this.cloudinary.deleteImageByUrl(existing.imageUrl);
      }
      return updated;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A merchant type with this code already exists',
        );
      }
      throw e;
    }
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    try {
      await this.prisma.merchantType.delete({ where: { id } });
      await this.cloudinary.deleteImageByUrl(existing.imageUrl);
      return { message: 'Merchant type deleted' };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete this merchant type while merchants use it',
        );
      }
      throw e;
    }
  }
}
