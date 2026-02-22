import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES } from '../../../../common/constants/roles.constants';

export class AdminTenantOverviewQueryDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'When false (default), counts include ACTIVE users only. When true, include all user statuses.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    if (value === false || value === 'false' || value === '0' || value === 0) return false;
    return value;
  })
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({
    example: ROLES.STUDENT,
    description:
      'Optional role filter for role-based counts (e.g., Student, Advisor, Coordinator).',
  })
  @IsOptional()
  @IsIn(Object.values(ROLES))
  roleName?: (typeof ROLES)[keyof typeof ROLES];
}
