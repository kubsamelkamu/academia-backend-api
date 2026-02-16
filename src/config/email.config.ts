import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  brevoApiKey: process.env.BREVO_API_KEY,
  fromEmail: process.env.EMAIL_FROM || 'noreply@academic-platform.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Academia',
  logoUrl: process.env.EMAIL_LOGO_URL,
  invitationExpiryDays: parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10),
  passwordResetOtpTemplateId: process.env.BREVO_PASSWORD_RESET_OTP_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PASSWORD_RESET_OTP_TEMPLATE_ID, 10)
    : undefined,
}));
