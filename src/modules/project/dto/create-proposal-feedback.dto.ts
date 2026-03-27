import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProposalFeedbackDto {
  @ApiProperty({
    description: 'Feedback message text',
    maxLength: 2000,
    example: 'Please clarify the problem statement and update the literature review section.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
