import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

export class InvalidCredentialsException extends UnauthorizedException {
  constructor(message = 'Invalid credentials') {
    super(message);
  }
}

export class UserNotFoundException extends UnauthorizedException {
  constructor(message = 'User not found') {
    super(message);
  }
}

export class AccountInactiveException extends UnauthorizedException {
  constructor(message = 'Account is not active') {
    super(message);
  }
}

export class TenantInactiveException extends UnauthorizedException {
  constructor(message = 'Tenant account is not active') {
    super(message);
  }
}

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor(message = 'Invalid refresh token') {
    super(message);
  }
}

export class PasswordNotSetException extends BadRequestException {
  constructor(message = 'Password is not set for this user') {
    super(message);
  }
}

export class IncorrectPasswordException extends UnauthorizedException {
  constructor(message = 'Current password is incorrect') {
    super(message);
  }
}

export class PasswordResetNotAvailableException extends BadRequestException {
  constructor(message = 'Password reset is not available for this account') {
    super(message);
  }
}

export class InvalidPasswordResetOtpException extends ForbiddenException {
  constructor(message = 'Invalid or expired verification code') {
    super(message);
  }
}

export class PasswordResetOtpLockedException extends HttpException {
  constructor(message = 'Too many attempts. Please try again later.') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class InvalidPasswordResetTokenException extends ForbiddenException {
  constructor(message = 'Invalid or expired reset token') {
    super(message);
  }
}

export class NoActivePasswordResetException extends BadRequestException {
  constructor(message = 'No active password reset request found') {
    super(message);
  }
}
