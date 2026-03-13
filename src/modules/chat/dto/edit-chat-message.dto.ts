import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EditChatMessageDto {
  @ApiProperty({
    description: 'New message text. May be empty only if the message has an attachment.',
  })
  @IsString()
  text: string;
}
