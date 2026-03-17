import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  statusUploadReminderTemplateId: process.env.BREVO_STATUS_UPLOAD_REMINDER_TEMPLATE_ID
    ? parseInt(process.env.BREVO_STATUS_UPLOAD_REMINDER_TEMPLATE_ID, 10)
    : undefined,
  statusUploadSuspendedTemplateId: process.env.BREVO_STATUS_UPLOAD_SUSPENDED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_STATUS_UPLOAD_SUSPENDED_TEMPLATE_ID, 10)
    : undefined,
  studentProfileCompletionReminderTemplateId: process.env
    .BREVO_STUDENT_PROFILE_COMPLETION_REMINDER_TEMPLATE_ID
    ? parseInt(process.env.BREVO_STUDENT_PROFILE_COMPLETION_REMINDER_TEMPLATE_ID, 10)
    : undefined,
  groupLeaderRequestSubmittedTemplateId: process.env
    .BREVO_GROUP_LEADER_REQUEST_SUBMITTED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_GROUP_LEADER_REQUEST_SUBMITTED_TEMPLATE_ID, 10)
    : undefined,
  groupLeaderRequestApprovedTemplateId: process.env.BREVO_GROUP_LEADER_REQUEST_APPROVED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_GROUP_LEADER_REQUEST_APPROVED_TEMPLATE_ID, 10)
    : undefined,
  groupLeaderRequestRejectedTemplateId: process.env.BREVO_GROUP_LEADER_REQUEST_REJECTED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_GROUP_LEADER_REQUEST_REJECTED_TEMPLATE_ID, 10)
    : undefined,
  projectGroupInvitationTemplateId: process.env.BREVO_PROJECT_GROUP_INVITATION_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROJECT_GROUP_INVITATION_TEMPLATE_ID, 10)
    : undefined,
  brevoApiKey: process.env.BREVO_API_KEY,
  fromEmail: process.env.EMAIL_FROM || 'noreply@academic-platform.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Academia',
  supportEmail: process.env.EMAIL_SUPPORT || 'support@academia.et',
  logoUrl: process.env.EMAIL_LOGO_URL,
  defaultAvatarUrl: process.env.EMAIL_DEFAULT_AVATAR_URL,
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

  // Institution verification (multi-tenant onboarding)
  institutionVerificationSubmittedAdminTemplateId: process.env
    .BREVO_INSTITUTION_VERIFICATION_SUBMITTED_ADMIN_TEMPLATE_ID
    ? parseInt(process.env.BREVO_INSTITUTION_VERIFICATION_SUBMITTED_ADMIN_TEMPLATE_ID, 10)
    : undefined,
  institutionVerificationReceivedDeptHeadTemplateId: process.env
    .BREVO_INSTITUTION_VERIFICATION_RECEIVED_DEPTHEAD_TEMPLATE_ID
    ? parseInt(process.env.BREVO_INSTITUTION_VERIFICATION_RECEIVED_DEPTHEAD_TEMPLATE_ID, 10)
    : undefined,
  institutionVerificationApprovedTemplateId: process.env
    .BREVO_INSTITUTION_VERIFICATION_APPROVED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_INSTITUTION_VERIFICATION_APPROVED_TEMPLATE_ID, 10)
    : undefined,
  institutionVerificationRejectedTemplateId: process.env
    .BREVO_INSTITUTION_VERIFICATION_REJECTED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_INSTITUTION_VERIFICATION_REJECTED_TEMPLATE_ID, 10)
    : undefined,
}));
