import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  localizeBanner,
  type I18nOptions,
  withLocaleValue,
} from '../common/i18n';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

export type BannerStatus = 'ACTIVE' | 'INACTIVE';

export type BannerItem = {
  id: string;
  title: string | null;
  titleAr: string | null;
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
    private readonly cloudinary: S3Service,
  ) {}

  private mapRow(row: {
    id: string;
    title: string | null;
    titleAr: string | null;
    imageUrl: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): BannerItem {
    return {
      id: row.id,
      title: row.title,
      titleAr: row.titleAr,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      status: row.isActive ? 'ACTIVE' : 'INACTIVE',
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  findActivePublic(i18n?: I18nOptions): Promise<(BannerItem & { locale?: string })[]> {
    return this.prisma.banner
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) =>
        rows.map((r) =>
          withLocaleValue(localizeBanner(this.mapRow(r), i18n), i18n),
        ),
      );
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
        title: dto.title?.trim() || null,
        titleAr: dto.titleAr?.trim() || null,
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
        ...(dto.title !== undefined ? { title: dto.title.trim() || null } : {}),
        ...(dto.titleAr !== undefined
          ? { titleAr: dto.titleAr.trim() || null }
          : {}),
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
