import { registerAs } from '@nestjs/config';

export default registerAs('push', () => ({
  vapidSubject: process.env.VAPID_SUBJECT || process.env.PUSH_VAPID_SUBJECT || '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || process.env.PUSH_VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || process.env.PUSH_VAPID_PRIVATE_KEY || '',
}));
