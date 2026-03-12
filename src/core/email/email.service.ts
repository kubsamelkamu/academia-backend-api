import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as brevo from '@getbrevo/brevo';

export type EmailAddress = {
  email: string;
  name?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiInstance: brevo.TransactionalEmailsApi;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly logoUrl?: string;

  constructor(private readonly config: ConfigService) {
    const apiKey =
      this.config.get<string>('email.brevoApiKey') ||
      this.config.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY;
    this.fromEmail = this.config.get<string>('email.fromEmail') || 'noreply@academic-platform.com';
    this.fromName = this.config.get<string>('email.fromName') || 'Academic Project Platform';
    this.logoUrl = this.config.get<string>('email.logoUrl') || process.env.EMAIL_LOGO_URL;

    this.apiInstance = new brevo.TransactionalEmailsApi();

    if (apiKey) {
      this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
      this.logger.debug(`Brevo API key loaded: yes (${apiKey.slice(0, 8)}...)`);
    } else {
      this.logger.warn('Brevo API key loaded: no (emails will be skipped)');
    }
  }

  async sendStatusUploadReminder(params: {
    email: string;
    name?: string;
    type: 'first' | 'second';
  }) {
    const templateId = this.config.get<number>('email.statusUploadReminderTemplateId');
    if (!templateId) {
      this.logger.warn(
        'Status upload reminder template ID not configured; skipping reminder email'
      );
      return;
    }
    await this.sendTransactionalTemplateEmail({
      to: { email: params.email, name: params.name },
      templateId,
      params: {
        ...this.getCommonTemplateParams(),
        reminderType: params.type,
      },
    });
  }

  async sendAccountSuspended(params: { email: string; name?: string }) {
    const templateId = this.config.get<number>('email.statusUploadSuspendedTemplateId');
    if (!templateId) {
      this.logger.warn(
        'Status upload suspended template ID not configured; skipping suspension email'
      );
      return;
    }
    await this.sendTransactionalTemplateEmail({
      to: { email: params.email, name: params.name },
      templateId,
      params: {
        ...this.getCommonTemplateParams(),
      },
    });
  }

  getCommonTemplateParams(): Record<string, unknown> {
    const supportEmail = this.config.get<string>('email.supportEmail') || 'support@academia.et';

    return {
      appName: this.fromName,
      logoUrl: this.logoUrl,
      supportEmail,
      currentYear: new Date().getFullYear(),
    };
  }

  async sendTransactionalEmail(params: {
    to: EmailAddress;
    subject: string;
    htmlContent: string;
    textContent?: string;
    replyTo?: EmailAddress;
  }): Promise<void> {
    const apiKey =
      this.config.get<string>('email.brevoApiKey') ||
      this.config.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY missing; skipping transactional email send');
      return;
    }

    this.logger.log(
      `Sending transactional email to=${params.to.email} subject=${JSON.stringify(params.subject)}`
    );

    // Ensure the SDK is always configured with the effective key.
    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    try {
      const result = await this.apiInstance.sendTransacEmail({
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: params.to.email, name: params.to.name }],
        replyTo: params.replyTo
          ? { email: params.replyTo.email, name: params.replyTo.name }
          : undefined,
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
      });

      // The SDK response shape may vary by version; log a compact identifier when present.
      const maybe: any = result as any;
      const messageId = maybe?.messageId || maybe?.body?.messageId || maybe?.data?.messageId;
      if (messageId) {
        this.logger.log(`Brevo accepted transactional email messageId=${String(messageId)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Brevo transactional email failed (${message})`);
      throw err;
    }
  }

  async sendTransactionalTemplateEmail(params: {
    to: EmailAddress;
    templateId: number;
    params?: Record<string, unknown>;
    replyTo?: EmailAddress;
  }): Promise<void> {
    const apiKey =
      this.config.get<string>('email.brevoApiKey') ||
      this.config.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY;
    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY missing; skipping transactional template email send');
      return;
    }

    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    await this.apiInstance.sendTransacEmail({
      sender: { email: this.fromEmail, name: this.fromName },
      to: [{ email: params.to.email, name: params.to.name }],
      replyTo: params.replyTo
        ? { email: params.replyTo.email, name: params.replyTo.name }
        : undefined,
      templateId: params.templateId,
      params: params.params ?? {},
    });
  }

  async sendContactEmailToSupport(params: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const supportEmail = this.config.get<string>('email.supportEmail') || 'support@academia.et';
    const templateId = this.config.get<number>('email.contactTemplateId');

    if (!templateId) {
      this.logger.warn('Contact template ID not configured; skipping contact email');
      return;
    }

    await this.sendTransactionalTemplateEmail({
      to: { email: supportEmail, name: 'Support Team' },
      templateId,
      replyTo: { email: params.email, name: params.name },
      params: {
        ...this.getCommonTemplateParams(),
        name: params.name,
        email: params.email,
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendAcknowledgmentEmail(params: { name: string; email: string }): Promise<void> {
    const templateId = this.config.get<number>('email.acknowledgmentTemplateId');

    if (!templateId) {
      this.logger.warn('Acknowledgment template ID not configured; skipping acknowledgment email');
      return;
    }

    await this.sendTransactionalTemplateEmail({
      to: { email: params.email, name: params.name },
      templateId,
      params: {
        ...this.getCommonTemplateParams(),
        name: params.name,
      },
    });
  }
}
