import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

import { DepartmentAnnouncementsService } from './department-announcements.service';
import { CreateDepartmentAnnouncementDto } from './dto/create-department-announcement.dto';
import { ListDepartmentAnnouncementsQueryDto } from './dto/list-department-announcements.dto';
import { UpdateDepartmentAnnouncementDto } from './dto/update-department-announcement.dto';

@ApiTags('Department Announcements')
@Controller({ path: 'departments/:departmentId/announcements', version: '1' })
export class DepartmentAnnouncementsController {
  constructor(private readonly service: DepartmentAnnouncementsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create department announcement with optional deadline' })
  @ApiResponse({ status: 201, description: 'Announcement created' })
  async create(
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateDepartmentAnnouncementDto,
    @GetUser() user: any
  ) {
    return this.service.createAnnouncement(departmentId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR, ROLES.STUDENT)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List department announcements with countdown fields' })
  @ApiResponse({ status: 200, description: 'Announcements retrieved' })
  async list(
    @Param('departmentId') departmentId: string,
    @Query() query: ListDepartmentAnnouncementsQueryDto,
    @GetUser() user: any
  ) {
    return this.service.listAnnouncements(departmentId, query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR, ROLES.STUDENT)
  @Get(':announcementId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single department announcement' })
  @ApiResponse({ status: 200, description: 'Announcement retrieved' })
  async getOne(
    @Param('departmentId') departmentId: string,
    @Param('announcementId') announcementId: string,
    @GetUser() user: any
  ) {
    return this.service.getAnnouncement(departmentId, announcementId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Patch(':announcementId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update department announcement' })
  @ApiResponse({ status: 200, description: 'Announcement updated' })
  async update(
    @Param('departmentId') departmentId: string,
    @Param('announcementId') announcementId: string,
    @Body() dto: UpdateDepartmentAnnouncementDto,
    @GetUser() user: any
  ) {
    return this.service.updateAnnouncement(departmentId, announcementId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Delete(':announcementId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete department announcement' })
  @ApiResponse({ status: 200, description: 'Announcement deleted' })
  async remove(
    @Param('departmentId') departmentId: string,
    @Param('announcementId') announcementId: string,
    @GetUser() user: any
  ) {
    return this.service.deleteAnnouncement(departmentId, announcementId, user);
  }
}
