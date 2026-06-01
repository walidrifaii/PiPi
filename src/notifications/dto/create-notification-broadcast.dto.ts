import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_NOTIFICATION_CATEGORIES } from '../user-notification.constants';

export class CreateNotificationBroadcastDto {
  @ApiProperty({ example: 'Flash Sale Promo Alert 🎉' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    example: 'Get 25% off your next delivery with code PIPPIP25!',
  })
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional({
    enum: USER_NOTIFICATION_CATEGORIES,
    default: 'SPECIAL_OFFER',
  })
  @IsOptional()
  @IsIn([...USER_NOTIFICATION_CATEGORIES])
  category?: (typeof USER_NOTIFICATION_CATEGORIES)[number];

  @ApiPropertyOptional({
    default: true,
    description: 'Also send FCM push when device token exists',
  })
  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}
