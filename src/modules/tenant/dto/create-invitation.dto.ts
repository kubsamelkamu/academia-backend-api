import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

import { ROLES } from '../../../common/constants/roles.constants';

export class CreateInvitationDto {
  @ApiProperty({ example: 'student@university.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Role to assign once invitation is accepted',
    example: ROLES.STUDENT,
    enum: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR])
  roleName: string;
}
