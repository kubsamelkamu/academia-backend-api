import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactDto {
  @ApiProperty({
    description: 'Name of the person contacting',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Email address of the person contacting',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Subject of the contact message',
    example: 'Inquiry about Academia platform',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subject: string;

  @ApiProperty({
    description: 'Message content',
    example: 'I would like to know more about your platform features.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
