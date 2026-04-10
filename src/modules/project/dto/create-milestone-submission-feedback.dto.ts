import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMilestoneSubmissionFeedbackDto {
  @ApiProperty({
    description: 'Feedback message text',
    example: 'Please revise the methodology section and update the architecture diagram.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
