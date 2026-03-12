import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ROLES } from '../../../common/constants/roles.constants';

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value))
    return value
      .map(String)
      .map((v) => v.trim())
      .filter(Boolean);
  const s = String(value).trim();
  if (!s) return undefined;
  return s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

export class ListInvitationsPagedQueryDto {
  @ApiPropertyOptional({
    description: 'Invitation status',
    enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'])
  status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

  @ApiPropertyOptional({
    description: 'Filter by invited role(s). Supports CSV: roleNames=STUDENT,ADVISOR',
    enum: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR],
    isArray: true,
    example: [ROLES.ADVISOR, ROLES.COORDINATOR],
  })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  roleNames?: string[];

  @ApiPropertyOptional({
    description: 'Search by email, first name, or last name',
    maxLength: 200,
    example: 'abebe',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim();
    return v.length ? v : undefined;
  })
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
