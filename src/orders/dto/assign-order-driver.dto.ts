import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignOrderDriverDto {
  @ApiProperty({ format: 'uuid', description: 'Driver to assign to this order' })
  @IsUUID()
  driverId!: string;
}
