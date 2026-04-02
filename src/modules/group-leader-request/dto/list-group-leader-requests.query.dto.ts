import { GroupLeaderRequestStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListGroupLeaderRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by request status. Omit to list all statuses.',
    enum: GroupLeaderRequestStatus,
    example: GroupLeaderRequestStatus.PENDING,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim().toUpperCase();
    return v.length ? v : undefined;
  })
  @IsEnum(GroupLeaderRequestStatus)
  status?: GroupLeaderRequestStatus;

  @ApiPropertyOptional({
    description: 'Search by student first name or last name',
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