# Brevo Email Templates

These HTML files are intended to be copied into Brevo Transactional Email templates.

## 1) Email Verification OTP
File: `email-verification-otp.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `institutionName`
- `departmentName`
- `departmentCode`
- `recipientRole`
- `otp`
- `expiresMinutes`

Backend config/env:
- `BREVO_EMAIL_VERIFICATION_OTP_TEMPLATE_ID`

## 2) Invitation
File: `invitation.html`

Notes:
- The invitation email must NOT include any password. After the invitee accepts the invitation, the API returns a temporary password once, and the user is forced to change it on first login.

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `tenantName`
- `tenantDomain`
- `roleName`
- `departmentName`
- `acceptUrl`
- `loginUrl`
- `expiresAt` (ISO string)
- `expiresDate` (human readable)

Backend config/env:
- `BREVO_INVITATION_TEMPLATE_ID`

## 3) Institution Verification (Admin Notification)
File: `institution-verification-submitted-admin.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `tenantName`
- `tenantDomain`
- `submittedByName`
- `submittedByEmail`
- `requestId`
- `submittedAt` (ISO string or human-readable)
- `fileName`
- `mimeType`
- `sizeKb`
- `documentUrl`

Backend config/env:
- `BREVO_INSTITUTION_VERIFICATION_SUBMITTED_ADMIN_TEMPLATE_ID`

## 4) Institution Verification (Received — Department Head)
File: `institution-verification-received-depthead.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `tenantName`
- `requestId`
- `submittedAt`

Backend config/env:
- `BREVO_INSTITUTION_VERIFICATION_RECEIVED_DEPTHEAD_TEMPLATE_ID`

## 5) Institution Verification (Approved)
File: `institution-verification-approved.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `tenantName`
- `requestId`
- `reviewedAt`
- `reason` (optional)

Backend config/env:
- `BREVO_INSTITUTION_VERIFICATION_APPROVED_TEMPLATE_ID`

## 6) Institution Verification (Rejected)
File: `institution-verification-rejected.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `tenantName`
- `requestId`
- `reviewedAt`
- `reason`

Backend config/env:
- `BREVO_INSTITUTION_VERIFICATION_REJECTED_TEMPLATE_ID`

## 7) Student Profile Completion Reminder
File: `student-profile-completion-reminder.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `profileUrl` (should point to `${FRONTEND_URL}/dashboard/profile`)

Backend config/env:
- `BREVO_STUDENT_PROFILE_COMPLETION_REMINDER_TEMPLATE_ID`

## 8) Project Group Invitation
File: `project-group-invitation.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `defaultAvatarUrl`
- `supportEmail`
- `currentYear`
- `inviteeName`
- `inviteeAvatarUrl`
- `leaderName`
- `leaderAvatarUrl`
- `groupName`
- `groupDescription` (optional)
- `acceptUrl`
- `rejectUrl`
- `expiresAt`

Backend config/env:
- `BREVO_PROJECT_GROUP_INVITATION_TEMPLATE_ID`

## 9) Proposal Submitted
File: `proposal-submitted.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `submitterName`
- `submitterEmail`
- `departmentName`
- `groupName`
- `status`

Backend config/env:
- `BREVO_PROPOSAL_SUBMITTED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 10) Proposal Feedback Added
File: `proposal-feedback-added.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `authorRole`
- `messagePreview`
- `status`

Backend config/env:
- `BREVO_PROPOSAL_FEEDBACK_ADDED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 11) Proposal Approved
File: `proposal-approved.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `departmentName`
- `status`
- `advisorAssigned`
- `advisorName`
- `advisorEmail`

Backend config/env:
- `BREVO_PROPOSAL_APPROVED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 12) Proposal Rejected
File: `proposal-rejected.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `departmentName`
- `status`
- `rejectionReason`

Backend config/env:
- `BREVO_PROPOSAL_REJECTED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 13) Project Advisor Assigned
File: `project-advisor-assigned.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `projectId`
- `projectTitle`
- `departmentName`
- `advisorName`
- `advisorEmail`

Backend config/env:
- `BREVO_PROJECT_ADVISOR_ASSIGNED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 14) Project Created
File: `project-created.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `projectId`
- `projectTitle`
- `proposalId`
- `proposalTitle`
- `departmentName`
- `advisorName`
- `advisorEmail`
- `memberCount`

Backend config/env:
- `BREVO_PROJECT_CREATED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 15) Proposal Resubmission Reminder (24h)
File: `proposal-resubmission-reminder-24h.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `departmentName`
- `status`
- `reminderId`
- `reminderTitle`
- `reminderMessage`
- `remaining`
- `deadlineAt`
- `reminderType`

Backend config/env:
- `BREVO_PROPOSAL_RESUBMISSION_REMINDER_24H_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 16) Proposal Resubmission Reminder (1h)
File: `proposal-resubmission-reminder-1h.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `departmentName`
- `status`
- `reminderId`
- `reminderTitle`
- `reminderMessage`
- `remaining`
- `deadlineAt`
- `reminderType`

Backend config/env:
- `BREVO_PROPOSAL_RESUBMISSION_REMINDER_1H_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.

## 17) Proposal Resubmission Deadline Passed
File: `proposal-resubmission-deadline-passed.html`

Expected `params` keys:
- `appName`
- `logoUrl`
- `supportEmail`
- `currentYear`
- `recipientName`
- `proposalId`
- `proposalTitle`
- `groupName`
- `departmentName`
- `status`
- `reminderId`
- `reminderTitle`
- `reminderMessage`
- `deadlineAt`
- `reminderType`
- `deadlinePassed`

Backend config/env:
- `BREVO_PROPOSAL_RESUBMISSION_DEADLINE_PASSED_TEMPLATE_ID`

Notes:
- Keep this informational only. Do not add action buttons to the template.
