import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Successfully logged in', type: LoginDto })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/auth/login',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register/institution')
  @Throttle({ default: { ttl: 300000, limit: 3 } }) // 5 minutes, 3 attempts
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new institution with department head',
    description: 'Creates a new university/institution, department, and department head account in one transaction'
  })
  @ApiResponse({
    status: 201,
    description: 'Institution registered successfully',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: {
          institution: {
            id: 'tenant-id',
            name: 'Addis Ababa University',
            domain: 'addisababauniversity'
          },
          department: {
            id: 'dept-id',
            name: 'Computer Science',
            code: 'CS'
          },
          departmentHead: {
            id: 'user-id',
            email: 'depthead@computing.edu.et',
            firstName: 'John',
            lastName: 'Smith',
            role: 'DepartmentHead'
          },
          nextSteps: [
            'Your institution has been created successfully',
            'You can now login with your email and password',
            'Start managing your department users and academic projects'
          ]
        },
        timestamp: '2026-02-07T08:34:06.948Z'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-04T13:06:04.194Z',
        path: '/api/v1/auth/register/institution',
      },
    },
  })
  async registerInstitution(@Body() registerDto: RegisterInstitutionDto) {
    return this.authService.registerInstitution(registerDto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
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
        path: '/api/v1/auth/refresh',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @GetUser('sub') userId: string,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(
      userId,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@GetUser() user: any) {
    return {
      id: user.sub,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
    };
  }
}
