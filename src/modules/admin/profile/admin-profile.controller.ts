import {
  Controller,
  Delete,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants/roles.constants';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminProfileService } from './admin-profile.service';
import { ConfigService } from '@nestjs/config';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';

@ApiTags('Admin Profile')
@Controller({ path: 'admin/profile', version: '1' })
export class AdminProfileController {
  constructor(
    private readonly adminProfileService: AdminProfileService,
    private readonly configService: ConfigService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current admin profile' })
  async me(@GetUser() user: any) {
    return this.adminProfileService.me(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('avatar')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['avatar'],
    },
  })
  @ApiOperation({ summary: 'Upload or overwrite admin avatar (Cloudinary)' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: Number(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!allowed.has(file.mimetype)) {
          return cb(new Error('Invalid file type'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadAvatar(@GetUser() user: any, @UploadedFile() avatar: Express.Multer.File) {
    // Ensure ConfigService is instantiated (and storage config loaded) before CloudinaryService init.
    void this.configService;
    return this.adminProfileService.uploadAvatar(user, avatar);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Delete('avatar')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current admin avatar (Cloudinary)' })
  async deleteAvatar(@GetUser() user: any) {
    void this.configService;
    await this.adminProfileService.deleteAvatar(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('change-password')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current admin password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/admin/profile/change-password',
      },
    },
  })
  async changePassword(@GetUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.adminProfileService.changePassword(userId, dto.oldPassword, dto.newPassword);
  }
}
