import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

/** The app_version table always has exactly one row with id = 1. */
const SINGLETON_ID = 1;

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppVersion() {
    const row = await this.prisma.appVersion.findUnique({
      where: { id: SINGLETON_ID },
    });

    return {
      latestVersion: row?.latestVersion ?? '1.0.0',
      minVersion: row?.minVersion ?? '1.0.0',
      androidUrl: row?.androidUrl ?? null,
      iosUrl: row?.iosUrl ?? null,
    };
  }

  async updateAppVersion(dto: UpdateAppVersionDto) {
    await this.prisma.appVersion.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        latestVersion: dto.latestVersion ?? '1.0.0',
        minVersion: dto.minVersion ?? '1.0.0',
        androidUrl: dto.androidUrl ?? null,
        iosUrl: dto.iosUrl ?? null,
      },
      update: {
        ...(dto.latestVersion !== undefined && { latestVersion: dto.latestVersion }),
        ...(dto.minVersion !== undefined && { minVersion: dto.minVersion }),
        ...(dto.androidUrl !== undefined && { androidUrl: dto.androidUrl }),
        ...(dto.iosUrl !== undefined && { iosUrl: dto.iosUrl }),
      },
    });

    return this.getAppVersion();
  }
}
