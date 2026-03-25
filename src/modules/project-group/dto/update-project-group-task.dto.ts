import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProjectGroupTaskDto {
  @ApiPropertyOptional({ example: 'Implement login UI' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Create the login screen and connect to API.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-04-05T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
