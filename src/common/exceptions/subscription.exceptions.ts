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
  constructor(message = 'Tenant is not on a Premium subscription') {
    super(message);
  }
}
