import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants/roles.constants';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminProfileService } from './admin-profile.service';
import { ConfigService } from '@nestjs/config';

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
  @ApiOperation({ summary: 'Upload/overwrite admin avatar (Cloudinary)' })
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
}
