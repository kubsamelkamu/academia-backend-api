import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PinMessageDto {
  @ApiProperty({ description: 'Message id to pin' })
  @IsString()
  messageId: string;
}
