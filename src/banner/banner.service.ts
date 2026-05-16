import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

export type BannerStatus = 'ACTIVE' | 'INACTIVE';

export type BannerItem = {
  id: string;
  imageUrl: string;
  status: BannerStatus;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private mapRow(row: {
    id: string;
    imageUrl: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): BannerItem {
    return {
      id: row.id,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      status: row.isActive ? 'ACTIVE' : 'INACTIVE',
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  findActivePublic(): Promise<BannerItem[]> {
    return this.prisma.banner
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((r) => this.mapRow(r)));
  }

  findAllAdmin(): Promise<BannerItem[]> {
    return this.prisma.banner
      .findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map((r) => this.mapRow(r)));
  }

  async findOneAdmin(id: string): Promise<BannerItem> {
    const row = await this.prisma.banner.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Banner not found');
    }
    return this.mapRow(row);
  }

  async create(dto: CreateBannerDto, imageUrl: string): Promise<BannerItem> {
    const row = await this.prisma.banner.create({
      data: {
        imageUrl,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.mapRow(row);
  }

  async update(
    id: string,
    dto: UpdateBannerDto,
    imageUrl?: string,
  ): Promise<BannerItem> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }

    const row = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    if (
      imageUrl !== undefined &&
      imageUrl !== existing.imageUrl
    ) {
      await this.cloudinary.deleteImageByUrl(existing.imageUrl);
    }

    return this.mapRow(row);
  }

  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }

    await this.prisma.banner.delete({ where: { id } });
    await this.cloudinary.deleteImageByUrl(existing.imageUrl);

    return { message: 'Banner deleted' };
  }

  requireImageFile(file?: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is required');
    }
    return file.buffer;
  }
}
