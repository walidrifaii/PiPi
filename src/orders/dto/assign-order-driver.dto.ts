import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignOrderDriverDto {
  @ApiProperty({
    description: 'Driver to assign to this order',
    format: 'uuid',
  })
  @IsUUID()
  driverId!: string;
}
