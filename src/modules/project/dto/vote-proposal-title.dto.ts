import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class VoteProposalTitleDto {
  @ApiProperty({
    description: '0-based index of the chosen title in proposal.proposedTitles (0..2)',
    minimum: 0,
    maximum: 2,
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(2)
  titleIndex: number;
}
