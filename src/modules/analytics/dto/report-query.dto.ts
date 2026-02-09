import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel'
}

export class ReportQueryDto {
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  advisorId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}