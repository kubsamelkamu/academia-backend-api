import { Body, Controller, Get, HttpCode, HttpStatus, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DepartmentGroupSizeSettingService } from './department-group-size-setting.service';
import { UpdateGroupSizeSettingDto } from './dto/update-group-size-setting.dto';
import { GroupSizeSettingResponseDto } from './dto/group-size-setting-response.dto';

@ApiTags('Department Settings')
@Controller({ path: 'department/settings', version: '1' })
export class DepartmentGroupSizeSettingController {
  constructor(private readonly departmentGroupSizeSettingService: DepartmentGroupSizeSettingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.PLATFORM_ADMIN)
  @Get('group-size')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get group size settings (min/max students per group)' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Only for Platform Admin' })
  @ApiResponse({ status: 200, type: GroupSizeSettingResponseDto })
  async getGroupSizeSetting(@GetUser() user: any, @Query('departmentId') departmentId?: string) {
    return this.departmentGroupSizeSettingService.getGroupSizeSetting(user, departmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.PLATFORM_ADMIN)
  @Put('group-size')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update group size settings (min/max students per group)' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Only for Platform Admin' })
  @ApiResponse({ status: 200, type: GroupSizeSettingResponseDto })
  async updateGroupSizeSetting(
    @GetUser() user: any,
    @Body() dto: UpdateGroupSizeSettingDto,
    @Query('departmentId') departmentId?: string
  ) {
    return this.departmentGroupSizeSettingService.updateGroupSizeSetting(user, dto, departmentId);
  }
}
