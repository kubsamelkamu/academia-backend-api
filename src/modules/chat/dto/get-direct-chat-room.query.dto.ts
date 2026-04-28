import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class GetDirectChatRoomQueryDto {
  @ApiProperty({ description: 'Coordinator or advisor user id for the direct chat counterpart' })
  @IsString()
  @IsUUID()
  counterpartUserId: string;
}
