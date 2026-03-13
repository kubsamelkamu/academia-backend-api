import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MarkReadUpToDto {
  @ApiProperty({ description: 'Message id to mark as read up to (inclusive)' })
  @IsString()
  messageId: string;
}
