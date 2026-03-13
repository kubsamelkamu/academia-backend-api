import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetReactionDto {
  @ApiProperty({ description: 'Emoji reaction (any emoji string). Max 1 per user per message.' })
  @IsString()
  emoji: string;
}
