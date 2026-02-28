import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min, Max, ValidateIf } from 'class-validator';

export class UpdateGroupSizeSettingDto {
  @ApiProperty({ example: 3, minimum: 1, description: 'Minimum number of students per group' })
  @IsInt()
  @Min(1)
  minGroupSize: number;

  @ApiProperty({ example: 5, minimum: 1, description: 'Maximum number of students per group' })
  @IsInt()
  @Min(1)
  maxGroupSize: number;
}
