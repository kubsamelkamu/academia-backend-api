import { BadRequestException, NotFoundException } from '@nestjs/common';

export class DepartmentNotFoundException extends NotFoundException {
  constructor(message = 'Department not found') {
    super(message);
  }
}

export class DepartmentCodeAlreadyExistsException extends BadRequestException {
  constructor(message = 'Department code already exists for this tenant') {
    super(message);
  }
}

export class DepartmentHeadNotFoundException extends NotFoundException {
  constructor(message = 'Head of department user not found') {
    super(message);
  }
}

export class DepartmentHeadInvalidTenantException extends BadRequestException {
  constructor(message = 'Head of department must belong to the same tenant') {
    super(message);
  }
}
