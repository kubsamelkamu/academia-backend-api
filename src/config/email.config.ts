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
  webhookSecret: process.env.EMAIL_WEBHOOK_SECRET || process.env.BREVO_WEBHOOK_SECRET,
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
  proposalSubmittedTemplateId: process.env.BREVO_PROPOSAL_SUBMITTED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_SUBMITTED_TEMPLATE_ID, 10)
    : undefined,
  proposalFeedbackAddedTemplateId: process.env.BREVO_PROPOSAL_FEEDBACK_ADDED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_FEEDBACK_ADDED_TEMPLATE_ID, 10)
    : undefined,
  proposalApprovedTemplateId: process.env.BREVO_PROPOSAL_APPROVED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_APPROVED_TEMPLATE_ID, 10)
    : undefined,
  proposalRejectedTemplateId: process.env.BREVO_PROPOSAL_REJECTED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_REJECTED_TEMPLATE_ID, 10)
    : undefined,
  proposalResubmissionReminder24hTemplateId: process.env
    .BREVO_PROPOSAL_RESUBMISSION_REMINDER_24H_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_RESUBMISSION_REMINDER_24H_TEMPLATE_ID, 10)
    : undefined,
  proposalResubmissionReminder1hTemplateId: process.env
    .BREVO_PROPOSAL_RESUBMISSION_REMINDER_1H_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_RESUBMISSION_REMINDER_1H_TEMPLATE_ID, 10)
    : undefined,
  proposalResubmissionDeadlinePassedTemplateId: process.env
    .BREVO_PROPOSAL_RESUBMISSION_DEADLINE_PASSED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROPOSAL_RESUBMISSION_DEADLINE_PASSED_TEMPLATE_ID, 10)
    : undefined,
  projectAdvisorAssignedTemplateId: process.env.BREVO_PROJECT_ADVISOR_ASSIGNED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROJECT_ADVISOR_ASSIGNED_TEMPLATE_ID, 10)
    : undefined,
  projectCreatedTemplateId: process.env.BREVO_PROJECT_CREATED_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROJECT_CREATED_TEMPLATE_ID, 10)
    : undefined,
  projectGroupMeetingReminder24hTemplateId: process.env
    .BREVO_PROJECT_GROUP_MEETING_REMINDER_24H_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROJECT_GROUP_MEETING_REMINDER_24H_TEMPLATE_ID, 10)
    : undefined,
  projectGroupMeetingReminder1hTemplateId: process.env
    .BREVO_PROJECT_GROUP_MEETING_REMINDER_1H_TEMPLATE_ID
    ? parseInt(process.env.BREVO_PROJECT_GROUP_MEETING_REMINDER_1H_TEMPLATE_ID, 10)
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
