import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendOrderMessageDto {
  @ApiProperty({ example: 'I am at the gate' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional({
    description: 'Client-generated Firestore message id (optimistic send)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  messageId?: string;
}
