import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { USER_NOTIFICATION_CHANNELS } from '../user-notification.constants';

export class ListUserNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: USER_NOTIFICATION_CHANNELS,
    default: 'INBOX',
    description: 'INBOX for normal notifications; DEVELOPER_LAB for test pushes.',
  })
  @IsOptional()
  @IsIn([...USER_NOTIFICATION_CHANNELS])
  channel?: (typeof USER_NOTIFICATION_CHANNELS)[number] = 'INBOX';
}
