import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  brevoApiKey: process.env.BREVO_API_KEY,
  fromEmail: process.env.EMAIL_FROM || 'noreply@academic-platform.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Academia',
  supportEmail: process.env.EMAIL_SUPPORT || 'support@academia.et',
  logoUrl: process.env.EMAIL_LOGO_URL,
  invitationExpiryDays: parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10),
  emailVerificationOtpTemplateId: process.env.BREVO_EMAIL_VERIFICATION_OTP_TEMPLATE_ID
    ? parseInt(process.env.BREVO_EMAIL_VERIFICATION_OTP_TEMPLATE_ID, 10)
    : undefined,
  invitationTemplateId: process.env.BREVO_INVITATION_TEMPLATE_ID
    ? parseInt(process.env.BREVO_INVITATION_TEMPLATE_ID, 10)
    : undefined,
  passwordResetOtpTemplateId: process.env.BREVO_PASSWORD_RESET_OTP_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PASSWORD_RESET_OTP_TEMPLATE_ID, 10)
    : undefined,
  contactTemplateId: process.env.BREVO_CONTACT_TEMPLATE_ID
    ? parseInt(process.env.BREVO_CONTACT_TEMPLATE_ID, 10)
    : undefined,
  acknowledgmentTemplateId: process.env.BREVO_CONTACT_ACK_TEMPLATE_ID
    ? parseInt(process.env.BREVO_CONTACT_ACK_TEMPLATE_ID, 10)
    : undefined,
}));
