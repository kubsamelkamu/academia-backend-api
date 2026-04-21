import { ApiProperty } from '@nestjs/swagger';

export class PlatformStatsDto {
  @ApiProperty({ example: 1280 })
  totalStudents: number;

  @ApiProperty({ example: 85 })
  totalAdvisors: number;

  @ApiProperty({ example: 320 })
  totalActiveProjects: number;

  @ApiProperty({ example: 140 })
  totalCompletedProjects: number;
}
