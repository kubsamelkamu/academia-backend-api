import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class GetAdvisorChatRoomQueryDto {
  @ApiProperty({ description: 'Supervised project id' })
  @IsString()
  @IsUUID()
  projectId: string;
}
