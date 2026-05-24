import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestNotificationDto {
  @ApiProperty({
    description: 'FCM device token from the mobile app (Firebase Messaging)',
    example: 'dXyZ...',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({ default: 'PipPip test' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ default: 'This is a test push notification from the API.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @ApiPropertyOptional({
    description: 'Optional string key/value payload delivered to the app',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
