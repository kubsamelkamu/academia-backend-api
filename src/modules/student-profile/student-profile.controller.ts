import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';


import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

import { StudentProfileService } from './student-profile.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@ApiTags('Student Profile')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('profile/student')
  @ApiOperation({ summary: 'Get my student profile' })
  @ApiResponse({ status: 200, description: 'Student profile retrieved successfully' })
  async getMy(@GetUser() user: any) {
    return this.studentProfileService.getMyStudentProfile(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Patch('profile/student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my student profile (bio, social links, tech stack)' })
  @ApiResponse({ status: 200, description: 'Student profile updated successfully' })
  async updateMy(@GetUser() user: any, @Body() dto: UpdateStudentProfileDto) {
    return this.studentProfileService.updateMyStudentProfile(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('students/:studentId/profile')
  @ApiParam({ name: 'studentId', description: 'Student user id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a student public profile (same tenant only)' })
  @ApiResponse({ status: 200, description: 'Student profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getPublic(@GetUser() user: any, @Param('studentId') studentId: string) {
    return this.studentProfileService.getStudentPublicProfile(user, studentId);
  }
}
