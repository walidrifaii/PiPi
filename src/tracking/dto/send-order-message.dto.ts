import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendOrderMessageDto {
  @ApiProperty({ example: 'I am at the gate' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}
