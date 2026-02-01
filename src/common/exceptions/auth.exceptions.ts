import { UnauthorizedException, BadRequestException } from '@nestjs/common';

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