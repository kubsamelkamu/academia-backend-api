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
