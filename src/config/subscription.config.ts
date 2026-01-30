import { registerAs } from '@nestjs/config';

export default registerAs('subscription', () => ({
  paddleApiKey: process.env.PADDLE_API_KEY,
  paddlePublicKey: process.env.PADDLE_PUBLIC_KEY,
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET,
  paddleEnvironment: process.env.PADDLE_ENVIRONMENT || 'sandbox',
}));
