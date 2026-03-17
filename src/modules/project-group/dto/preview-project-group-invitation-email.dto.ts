import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class PreviewProjectGroupInvitationEmailDto {
  @ApiProperty({ description: 'Student userId to preview invitation email for' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  invitedUserId: string;
}
