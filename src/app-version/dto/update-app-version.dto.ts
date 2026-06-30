import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class UpdateAppVersionDto {
  @ApiPropertyOptional({
    example: '1.2.0',
    description: 'Latest published app version (semantic version string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'latestVersion must be in x.y.z format' })
  latestVersion?: string;

  @ApiPropertyOptional({
    example: '1.0.0',
    description: 'Minimum supported version — app will force-update if below this',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minVersion must be in x.y.z format' })
  minVersion?: string;

  @ApiPropertyOptional({
    example: 'https://play.google.com/store/apps/details?id=com.pippip.app',
    description: 'Google Play Store URL for the Android app',
  })
  @IsOptional()
  @IsUrl()
  androidUrl?: string;

  @ApiPropertyOptional({
    example: 'https://apps.apple.com/app/pippip/id123456789',
    description: 'Apple App Store URL for the iOS app',
  })
  @IsOptional()
  @IsUrl()
  iosUrl?: string;
}
