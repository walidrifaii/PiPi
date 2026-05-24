import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional FCM device token sent from the mobile app on login/register. */
export class OptionalFcmTokenDto {
  @ApiPropertyOptional({
    description: 'Firebase Cloud Messaging device token',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}
