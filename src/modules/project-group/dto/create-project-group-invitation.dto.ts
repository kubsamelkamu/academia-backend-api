import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateProjectGroupInvitationDto {
  @ApiProperty({ description: 'Student userId to invite' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  invitedUserId: string;
}
