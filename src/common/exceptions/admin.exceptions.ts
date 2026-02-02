import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';

export class UnauthorizedAccessException extends UnauthorizedException {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class InsufficientPermissionsException extends ForbiddenException {
  constructor(message = 'Insufficient permissions') {
    super(message);
  }
}

export class TwoFactorNotEnabledException extends ForbiddenException {
  constructor(message = 'Two-factor authentication is not enabled') {
    super(message);
  }
}

export class InvalidTwoFactorTokenException extends ForbiddenException {
  constructor(message = 'Invalid or expired two-factor token') {
    super(message);
  }
}

export class InvalidTwoFactorMethodException extends ForbiddenException {
  constructor(message = 'Invalid two-factor method') {
    super(message);
  }
}

export class InvalidTwoFactorCodeException extends ForbiddenException {
  constructor(message = 'Invalid authentication code') {
    super(message);
  }
}

export class TwoFactorSetupNotStartedException extends ForbiddenException {
  constructor(message = 'Two-factor setup not started') {
    super(message);
  }
}

export class NoBackupCodesAvailableException extends ForbiddenException {
  constructor(message = 'No backup codes available') {
    super(message);
  }
}

export class InvalidBackupCodeException extends ForbiddenException {
  constructor(message = 'Invalid backup code') {
    super(message);
  }
}

export class AvatarFileRequiredException extends BadRequestException {
  constructor(message = 'Avatar file is required') {
    super(message);
  }
}
