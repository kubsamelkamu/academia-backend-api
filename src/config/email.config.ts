import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  brevoApiKey: process.env.BREVO_API_KEY,
  fromEmail: process.env.EMAIL_FROM || 'noreply@academic-platform.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Academic Project Platform',
  invitationExpiryDays: parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10),
}));
