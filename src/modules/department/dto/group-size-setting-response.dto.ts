import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class GroupSizeSettingResponseDto {
  @ApiProperty({ example: 3 })
  minGroupSize: number;

  @ApiProperty({ example: 5 })
  maxGroupSize: number;
}
