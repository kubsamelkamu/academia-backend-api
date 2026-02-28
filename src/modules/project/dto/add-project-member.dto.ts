import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ description: 'User ID to add as a student member', format: 'uuid' })
  @IsUUID()
  userId: string;
}
