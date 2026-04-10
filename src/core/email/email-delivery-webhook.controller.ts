import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { EmailDeliveryWebhookService } from './email-delivery-webhook.service';

@ApiExcludeController()
@Controller({ path: 'email/webhooks', version: '1' })
export class EmailDeliveryWebhookController {
  constructor(private readonly service: EmailDeliveryWebhookService) {}

  @Post('delivery')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleDeliveryWebhook(
    @Headers('x-email-webhook-secret') secret: string | undefined,
    @Body() payload: unknown
  ): Promise<{ received: boolean; processed: number; matched: number }> {
    this.service.assertWebhookSecret(secret);
    const result = await this.service.handleWebhook(payload);

    return {
      received: true,
      ...result,
    };
  }
}