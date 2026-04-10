import { ArrayMinSize, ArrayUnique, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignProjectEvaluatorsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  evaluatorIds!: string[];
}
