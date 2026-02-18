import { BadRequestException, NotFoundException } from '@nestjs/common';

export class FreePlanNotConfiguredException extends NotFoundException {
  constructor(message = 'Free subscription plan is not configured') {
    super(message);
  }
}

export class TenantSubscriptionNotFoundException extends NotFoundException {
  constructor(message = 'Tenant subscription not found') {
    super(message);
  }
}

export class TenantSubscriptionNotPremiumException extends BadRequestException {
  constructor(message = 'Tenant is not on a Pro subscription') {
    super(message);
  }
}

export class DepartmentSubscriptionNotFoundException extends NotFoundException {
  constructor(message = 'Department subscription not found') {
    super(message);
  }
}

export class DepartmentSubscriptionNotProException extends BadRequestException {
  constructor(message = 'Department is not on a Pro subscription') {
    super(message);
  }
}

export class PlanLimitExceededException extends BadRequestException {
  constructor(message = 'Plan limit exceeded. Upgrade required') {
    super(message);
  }
}
