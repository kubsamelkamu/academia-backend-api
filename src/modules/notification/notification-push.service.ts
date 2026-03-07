import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PushSubscriptionRepository } from './push-subscription.repository';

function normalizeBase64(value: string): string {
  // Accept both base64 and base64url.
  let normalized = (value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) normalized += '=';
  return normalized;
}

function assertValidWebPushKeys(keys: { p256dh: string; auth: string }) {
  try {
    const p256dhBytes = Buffer.from(normalizeBase64(keys.p256dh), 'base64');
    const authBytes = Buffer.from(normalizeBase64(keys.auth), 'base64');

    // web-push expects:
    // - p256dh: 65 bytes (uncompressed P-256 public key)
    // - auth: 16 bytes (auth secret)
    if (p256dhBytes.length !== 65) {
      throw new BadRequestException('Invalid subscription.keys.p256dh (must decode to 65 bytes)');
    }
    if (authBytes.length !== 16) {
      throw new BadRequestException('Invalid subscription.keys.auth (must decode to 16 bytes)');
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('Invalid subscription keys encoding (expected base64/base64url)');
  }
}

@Injectable()
export class NotificationPushService {
  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: PushSubscriptionRepository
  ) {}

  getVapidPublicKey(): string | null {
    const key = (this.config.get<string>('push.vapidPublicKey') || '').trim();
    return key || null;
  }

  async subscribe(params: {
    tenantId: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationTime?: number | null;
    userAgent?: string | null;
  }): Promise<void> {
    if (!params.endpoint?.startsWith('https://')) {
      throw new BadRequestException('Invalid subscription endpoint (must start with https://)');
    }

    assertValidWebPushKeys({ p256dh: params.p256dh, auth: params.auth });

    await this.subscriptions.upsertForUser({
      tenantId: params.tenantId,
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      expirationTime: params.expirationTime,
      userAgent: params.userAgent ?? null,
    });
  }

  async unsubscribe(params: {
    tenantId: string;
    userId: string;
    endpoint?: string;
  }): Promise<number> {
    if (params.endpoint) {
      return this.subscriptions.deleteByEndpointForUser({
        tenantId: params.tenantId,
        userId: params.userId,
        endpoint: params.endpoint,
      });
    }

    return this.subscriptions.deleteAllForUser(params.tenantId, params.userId);
  }
}
