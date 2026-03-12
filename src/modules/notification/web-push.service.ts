import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

import { PushSubscriptionRepository } from './push-subscription.repository';

type WebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  private readonly vapidSubject: string;
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: PushSubscriptionRepository
  ) {
    this.vapidSubject = (this.config.get<string>('push.vapidSubject') || '').trim();
    this.vapidPublicKey = (this.config.get<string>('push.vapidPublicKey') || '').trim();
    this.vapidPrivateKey = (this.config.get<string>('push.vapidPrivateKey') || '').trim();

    if (this.isConfigured()) {
      webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
    } else {
      this.logger.warn(
        'Web Push not configured (missing VAPID_SUBJECT/VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)'
      );
    }
  }

  getVapidPublicKey(): string | null {
    const key = (this.config.get<string>('push.vapidPublicKey') || '').trim();
    return key || null;
  }

  isConfigured(): boolean {
    return Boolean(this.vapidSubject && this.vapidPublicKey && this.vapidPrivateKey);
  }

  /**
   * Best-effort: never throw to caller.
   */
  async sendToUserBestEffort(params: {
    tenantId: string;
    userId: string;
    payload: {
      notificationId: string;
      title: string;
      message: string;
      eventType: string;
      severity: string;
      createdAt: string;
      metadata?: any;
    };
  }): Promise<void> {
    if (!this.isConfigured()) return;

    let subs = [] as Awaited<ReturnType<PushSubscriptionRepository['findForUser']>>;
    try {
      subs = await this.subscriptions.findForUser(params.tenantId, params.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WebPush: failed to load subscriptions (${message})`);
      return;
    }

    if (subs.length === 0) return;

    const jsonPayload = JSON.stringify({
      type: 'notification',
      ...params.payload,
    });

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        const subscription: WebPushSubscription = {
          endpoint: s.endpoint,
          expirationTime: s.expirationTime ? Number(s.expirationTime) : null,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };

        try {
          await webpush.sendNotification(subscription as any, jsonPayload);
          await this.subscriptions.markLastUsed(s.endpoint);
        } catch (error: any) {
          const statusCode = Number(error?.statusCode ?? error?.status ?? 0);

          // Subscription is no longer valid.
          if (statusCode === 404 || statusCode === 410) {
            try {
              await this.subscriptions.deleteByEndpoint(s.endpoint);
            } catch {
              // ignore cleanup failures
            }
          }

          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `WebPush: send failed (userId=${params.userId}, status=${statusCode || 'n/a'}): ${message}`
          );
        }
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 3)
        .join(' | ');
      this.logger.warn(
        `WebPush: internal send errors ${rejected.length}/${results.length} (${reasons})`
      );
    }
  }
}
