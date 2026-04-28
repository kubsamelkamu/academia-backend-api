import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class SendDirectChatMessageAttachmentDto {
  @ApiPropertyOptional({ enum: ['FILE'] })
  @IsOptional()
  @IsString()
  @IsIn(['FILE'])
  kind?: 'FILE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiPropertyOptional({ enum: ['image', 'raw'] })
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @IsIn(['image', 'raw'])
  resourceType?: 'image' | 'raw';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsInt()
  @Min(0)
  @Max(5 * 1024 * 1024)
  size?: number;
}

export class SendDirectChatMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  replyToMessageId?: string;

  @ApiPropertyOptional({ type: SendDirectChatMessageAttachmentDto })
  @IsOptional()
  attachment?: SendDirectChatMessageAttachmentDto;
}
