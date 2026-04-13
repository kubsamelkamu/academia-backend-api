import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveAdvisorProjectEvaluationDraftStudentDto {
  @ApiProperty()
  @IsUUID()
  studentUserId: string;

  @ApiProperty({ minimum: 0, maximum: 100, example: 84.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SaveAdvisorProjectEvaluationDraftDto {
  @ApiProperty({ type: () => [SaveAdvisorProjectEvaluationDraftStudentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveAdvisorProjectEvaluationDraftStudentDto)
  students: SaveAdvisorProjectEvaluationDraftStudentDto[];
}