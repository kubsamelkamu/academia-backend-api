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
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminProfileService } from './admin-profile.service';
import { ConfigService } from '@nestjs/config';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';
import { UpdateNameDto } from './dto/update-name.dto';

@ApiTags('Profile')
@Controller({ path: 'profile', version: '1' })
export class AdminProfileController {
  constructor(
    private readonly adminProfileService: AdminProfileService,
    private readonly configService: ConfigService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@GetUser() user: any) {
    return this.adminProfileService.me(user);
  }

  @UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Upload or overwrite current user avatar (Cloudinary)' })
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

  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user avatar (Cloudinary)' })
  async deleteAvatar(@GetUser() user: any) {
    void this.configService;
    await this.adminProfileService.deleteAvatar(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-name')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user name' })
  @ApiResponse({
    status: 200,
    description: 'Name updated successfully',
    schema: {
      example: {
        id: 'user-uuid',
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://cloudinary.com/avatar.jpg',
        tenantId: 'tenant-uuid',
        roles: ['PLATFORM_ADMIN'],
        lastLoginAt: '2026-02-05T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid name data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-05T10:30:00.000Z',
        path: '/api/v1/profile/update-name',
      },
    },
  })
  async updateName(@GetUser() user: any, @Body() dto: UpdateNameDto) {
    return this.adminProfileService.updateName(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
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
        path: '/api/v1/profile/change-password',
      },
    },
  })
  async changePassword(@GetUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.adminProfileService.changePassword(userId, dto.oldPassword, dto.newPassword);
  }
}
