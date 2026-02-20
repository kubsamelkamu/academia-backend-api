import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordVerifyDto } from './dto/forgot-password-verify.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';
import { EmailVerificationRequestDto } from './dto/email-verification-request.dto';
import { EmailVerificationVerifyDto } from './dto/email-verification-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('email-verification/request')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email verification OTP (email)' })
  @ApiResponse({
    status: 200,
    description: 'If account exists, code is sent',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: {
          message: 'If an account exists for that email, a verification code has been sent.',
        },
        timestamp: '2026-02-20T08:34:06.948Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        success: false,
        message: ['email must be an email', 'tenantDomain should not be empty'],
        error: { code: 'BADREQUEST' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/email-verification/request',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/email-verification/request',
      },
    },
  })
  async emailVerificationRequest(@Body() dto: EmailVerificationRequestDto) {
    return this.authService.requestEmailVerification(dto);
  }

  @Public()
  @Post('email-verification/verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email using OTP' })
  @ApiResponse({
    status: 200,
    description: 'Email verified',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: { verified: true, message: 'Email verified successfully' },
        timestamp: '2026-02-20T08:34:06.948Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid tenant domain, invalid/expired OTP, or too many attempts',
    schema: {
      example: {
        success: false,
        message: 'Invalid or expired verification code',
        error: { code: 'BADREQUEST' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/email-verification/verify',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/email-verification/verify',
      },
    },
  })
  async emailVerificationVerify(@Body() dto: EmailVerificationVerifyDto) {
    return this.authService.verifyEmailVerificationOtp(dto);
  }

  @Public()
  @Post('email-verification/resend')
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP for email verification' })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        success: false,
        message: ['email must be an email', 'tenantDomain should not be empty'],
        error: { code: 'BADREQUEST' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/email-verification/resend',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many resend attempts' })
  async emailVerificationResend(@Body() dto: EmailVerificationRequestDto) {
    return this.authService.resendEmailVerification(dto);
  }

  @Public()
  @Post('forgot-password/request')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP (email)' })
  @ApiResponse({ status: 200, description: 'If account exists, code is sent' })
  async forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.requestForgotPassword(dto);
  }

  @Public()
  @Post('forgot-password/verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive a short-lived reset token' })
  @ApiResponse({ status: 200, description: 'OTP verified' })
  @ApiResponse({ status: 403, description: 'Invalid or expired OTP' })
  async forgotPasswordVerify(@Body() dto: ForgotPasswordVerifyDto) {
    return this.authService.verifyForgotPasswordOtp(dto);
  }

  @Public()
  @Post('forgot-password/reset')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 403, description: 'Invalid or expired reset token' })
  async forgotPasswordReset(@Body() dto: ForgotPasswordResetDto) {
    return this.authService.resetForgottenPassword(dto);
  }

  @Public()
  @Post('forgot-password/resend')
  @Throttle({ default: { ttl: 3600000, limit: 3 } }) // 3 resends per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP for password reset' })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  @ApiResponse({ status: 400, description: 'No active reset request' })
  @ApiResponse({ status: 429, description: 'Too many resend attempts' })
  async forgotPasswordResend(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.resendForgotPasswordOtp(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: {
          accessToken: 'eyJhbGciOi... (JWT)',
          refreshToken: 'eyJhbGciOi... (JWT)',
          user: {
            id: 'user-id',
            email: 'depthead@computing.edu.et',
            firstName: 'John',
            lastName: 'Smith',
            avatarUrl: null,
            roles: ['DepartmentHead'],
            tenantId: 'tenant-id',
          },
        },
        timestamp: '2026-02-20T08:34:06.948Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        success: false,
        message: ['email must be an email', 'password should not be empty'],
        error: { code: 'BADREQUEST' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/login',
      },
    },
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
        path: '/api/v1/auth/login',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials / account inactive / tenant inactive',
    schema: {
      example: {
        success: false,
        message: 'Invalid credentials',
        error: { code: 'UNAUTHORIZED' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/login',
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register/institution')
  @Throttle({ default: { ttl: 300000, limit: 3 } }) // 5 minutes, 3 attempts
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new institution with department head',
    description:
      'Creates a new university/institution, department, and department head account in one transaction. ' +
      'The department head starts in PENDING state until email verification is completed.',
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
            domain: 'addisababauniversity',
          },
          department: {
            id: 'dept-id',
            name: 'Computer Science',
            code: 'CS',
          },
          departmentHead: {
            id: 'user-id',
            email: 'depthead@computing.edu.et',
            firstName: 'John',
            lastName: 'Smith',
            role: 'DepartmentHead',
          },
          nextSteps: [
            'Your institution has been created successfully',
            'Verify your email address using the code sent to your email',
            'After verification, you can login with your email and password',
            'Start managing your department users and academic projects',
          ],
        },
        timestamp: '2026-02-07T08:34:06.948Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
    schema: {
      example: {
        success: false,
        message: 'Email already registered',
        error: { code: 'EMAILALREADYREGISTERED' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/auth/register/institution',
      },
    },
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
