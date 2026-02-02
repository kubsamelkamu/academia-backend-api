import { BadRequestException } from '@nestjs/common';

export class MissingPlatformAdminPasswordException extends BadRequestException {
  constructor(message = 'PLATFORM_ADMIN_PASSWORD is required when NODE_ENV is not development') {
    super(message);
  }
}

export class MissingDatabaseUrlException extends BadRequestException {
  constructor(message = 'DATABASE_URL is required to run database seeds') {
    super(message);
  }
}
