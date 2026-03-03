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
