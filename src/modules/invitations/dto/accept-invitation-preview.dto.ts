import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInvitationPreviewDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
