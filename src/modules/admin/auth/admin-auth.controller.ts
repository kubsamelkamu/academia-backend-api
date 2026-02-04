import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES } from '../../../common/constants/roles.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { LoginDto } from '../../auth/dto/login.dto';
import { RefreshTokenDto } from '../../auth/dto/refresh-token.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminTwoFactorLoginDto } from './dto/admin-2fa-login.dto';
import { AdminTwoFactorVerifyDto } from './dto/admin-2fa-verify.dto';
import { Throttle } from '@nestjs/throttler';
@ApiTags('Admin Auth')
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login (Platform Admin)' })
  @ApiResponse({ status: 200, description: 'Successfully logged in' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/admin/auth/login',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.adminAuthService.login(loginDto);
  }

  @Public()
  @Post('login/2fa')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete admin login with 2FA / backup code' })
  @ApiResponse({ status: 200, description: 'Successfully logged in' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/admin/auth/login/2fa',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Invalid 2FA token or code' })
  async loginTwoFactor(@Body() dto: AdminTwoFactorLoginDto) {
    return this.adminAuthService.loginTwoFactor(dto.twoFactorToken, dto.code, dto.method);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh admin access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/admin/auth/refresh',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.adminAuthService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current admin session profile' })
  @ApiResponse({ status: 200, description: 'Admin profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@GetUser() user: any) {
    return this.adminAuthService.me(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (stateless; client clears tokens)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout() {
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('2fa/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get 2FA status' })
  async twoFactorStatus(@GetUser() user: any) {
    return this.adminAuthService.twoFactorStatus(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('2fa/enable')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start enabling 2FA (returns secret + otpauth URL)' })
  async twoFactorEnable(@GetUser() user: any) {
    return this.adminAuthService.twoFactorEnable(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('2fa/verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code and activate 2FA' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/admin/auth/2fa/verify',
      },
    },
  })
  async twoFactorVerify(@GetUser() user: any, @Body() dto: AdminTwoFactorVerifyDto) {
    return this.adminAuthService.twoFactorVerify(user, dto.code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('2fa/disable')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  async twoFactorDisable(@GetUser() user: any) {
    return this.adminAuthService.twoFactorDisable(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('2fa/backup-codes/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get remaining backup codes count' })
  async backupCodesStatus(@GetUser() user: any) {
    return this.adminAuthService.backupCodesStatus(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('2fa/backup-codes/generate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate backup codes (shown once)' })
  @ApiResponse({ status: 200, description: 'Backup codes generated' })
  async backupCodesGenerate(@GetUser() user: any) {
    return this.adminAuthService.backupCodesGenerate(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('2fa/backup-codes/regenerate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes (invalidates old codes)' })
  async backupCodesRegenerate(@GetUser() user: any) {
    return this.adminAuthService.backupCodesRegenerate(user);
  }
}
