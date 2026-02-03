import { BadRequestException, NotFoundException } from '@nestjs/common';

export class TenantNotFoundException extends NotFoundException {
  constructor(message = 'Tenant not found') {
    super(message);
  }
}

export class TenantDomainAlreadyExistsException extends BadRequestException {
  constructor(message = 'Tenant domain already exists') {
    super(message);
  }
}
