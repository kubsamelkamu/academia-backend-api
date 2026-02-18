import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { PaddleWebhookService } from './paddle-webhook.service';

@ApiTags('Billing Webhooks')
@Controller({ path: 'billing/paddle', version: '1' })
export class PaddleWebhookController {
  constructor(private readonly paddleWebhookService: PaddleWebhookService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Paddle webhook events' })
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('paddle-signature') signature: string | undefined,
    @Body() body: unknown
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});

    return this.paddleWebhookService.processWebhook({
      rawBody,
      signature,
    });
  }
}
