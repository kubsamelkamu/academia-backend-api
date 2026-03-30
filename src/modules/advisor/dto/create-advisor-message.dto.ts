import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();

export class CreateAdvisorMessageDto {
  @ApiProperty({ description: 'Message body' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ description: 'Optional attachment metadata JSON' })
  @IsOptional()
  attachments?: unknown;
}
