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

  constructor(private readonly config: ConfigService) {
    const apiKey =
      this.config.get<string>('email.brevoApiKey') ||
      this.config.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY;
    this.fromEmail = this.config.get<string>('email.fromEmail') || 'noreply@academic-platform.com';
    this.fromName = this.config.get<string>('email.fromName') || 'Academic Project Platform';

    this.apiInstance = new brevo.TransactionalEmailsApi();

    if (apiKey) {
      this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
      this.logger.debug(`Brevo API key loaded: yes (${apiKey.slice(0, 8)}...)`);
    } else {
      this.logger.warn('Brevo API key loaded: no (emails will be skipped)');
    }
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

    // Ensure the SDK is always configured with the effective key.
    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    await this.apiInstance.sendTransacEmail({
      sender: { email: this.fromEmail, name: this.fromName },
      to: [{ email: params.to.email, name: params.to.name }],
      replyTo: params.replyTo
        ? { email: params.replyTo.email, name: params.replyTo.name }
        : undefined,
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
    });
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
        name: params.name,
        email: params.email,
        subject: params.subject,
        message: params.message,
      },
    });
  }

  async sendAcknowledgmentEmail(params: {
    name: string;
    email: string;
  }): Promise<void> {
    const templateId = this.config.get<number>('email.acknowledgmentTemplateId');

    if (!templateId) {
      this.logger.warn('Acknowledgment template ID not configured; skipping acknowledgment email');
      return;
    }

    await this.sendTransactionalTemplateEmail({
      to: { email: params.email, name: params.name },
      templateId,
      params: {
        name: params.name,
      },
    });
  }
}
