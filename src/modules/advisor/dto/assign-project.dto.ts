import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';

export class AssignProjectDto {
  @ApiProperty({
    description: 'Project ID to assign to advisor',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({
    description: 'Assignment notes',
    example: 'Student needs guidance on ML algorithms',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Expected completion date',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  expectedCompletionDate?: string;

  @ApiPropertyOptional({
    description: 'Is primary advisor',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: 'Assignment role/type',
    example: 'Technical Advisor',
  })
  @IsString()
  @IsOptional()
  assignmentType?: string;
}
