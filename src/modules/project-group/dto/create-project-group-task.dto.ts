import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProjectGroupTaskDto {
  @ApiProperty({ example: 'Implement login UI' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'Create the login screen and connect to API.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-04-05T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Assignee userId (leader can assign anyone; members can only self-assign).',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
