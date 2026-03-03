export type InvitationEmailContentInput = {
  commonTemplateParams: Record<string, unknown>;
  tenantName: string;
  tenantDomain?: string;
  inviteeFirstName?: string;
  inviteeLastName?: string;
  roleName: string;
  departmentName?: string;
  acceptUrl: string;
  loginUrl: string;
  expiresAt: Date;
  customSubject?: string;
  customMessage?: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const plainTextToHtml = (value: string): string => {
  const normalized = value.replace(/\r\n/g, '\n');
  return escapeHtml(normalized).replace(/\n/g, '<br/>');
};

export const buildInvitationEmailContent = (
  input: InvitationEmailContentInput
): {
  subject: string;
  htmlContent: string;
  textContent: string;
  templateParams: Record<string, unknown>;
} => {
  const tenantName = input.tenantName || 'Academia';
  const subject = (input.customSubject ?? '').trim() || `You're invited to join ${tenantName}`;

  const common = input.commonTemplateParams as Record<string, unknown>;
  const appName = String(common.appName ?? 'Academia');
  const logoUrl = common.logoUrl ? String(common.logoUrl) : undefined;
  const supportEmail = common.supportEmail ? String(common.supportEmail) : undefined;
  const currentYear = String(common.currentYear ?? new Date().getFullYear());

  const message = (input.customMessage ?? '').trim();
  const messageHtml = message ? plainTextToHtml(message) : '';

  const inviteeFirstName = (input.inviteeFirstName ?? '').trim();
  const inviteeLastName = (input.inviteeLastName ?? '').trim();
  const inviteeFullName = [inviteeFirstName, inviteeLastName].filter(Boolean).join(' ').trim();

  const headerLogoCell = logoUrl
    ? `<td style="vertical-align:middle;padding-right:10px;">
                      <img src="${escapeHtml(logoUrl)}" width="28" height="28" alt="${escapeHtml(appName)}"
                        style="display:block;border:0;outline:none;text-decoration:none;" />
                    </td>`
    : '';

  const departmentBlock = input.departmentName
    ? `<p style="margin:0 0 14px 0;font-size:14px;line-height:20px;color:#111827;">
                  Department: <strong>${escapeHtml(input.departmentName)}</strong>
                </p>`
    : '';

  const domainBlock = input.tenantDomain
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;">
                  <tr>
                    <td style="font-size:13px;color:#6b7280;padding:0 0 6px 0;">Tenant domain</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#111827;line-height:20px;">
                      <strong>${escapeHtml(input.tenantDomain)}</strong>
                    </td>
                  </tr>
                </table>`
    : '';

  const messageBlock = message
    ? `<div style="margin:0 0 14px 0;padding:12px 14px;background:#f3f4f6;border-radius:10px;">
                  <div style="font-size:12px;color:#6b7280;margin:0 0 6px 0;">Message from your department</div>
                  <div style="font-size:14px;color:#111827;line-height:20px;"><strong>${messageHtml}</strong></div>
                </div>`
    : '';

  const supportFooterBlock = supportEmail
    ? `Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6b7280;text-decoration:underline;">${escapeHtml(
        supportEmail
      )}</a>
                <br />`
    : '';

  const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're invited</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:680px;max-width:680px;">
            <!-- Header -->
            <tr>
              <td style="padding:0 16px 12px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    ${headerLogoCell}
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:700;">${escapeHtml(appName)}</div>
                      <div style="font-size:12px;color:#6b7280;">Invitation</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border-radius:12px;padding:20px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <h1 style="margin:0 0 12px 0;font-size:16px;line-height:22px;">You're invited to join ${escapeHtml(
                  tenantName
                )}</h1>

                <p style="margin:0 0 10px 0;font-size:14px;line-height:20px;color:#111827;">
                  Hi${inviteeFullName ? ` <strong>${escapeHtml(inviteeFullName)}</strong>` : ''},
                </p>

                <p style="margin:0 0 10px 0;font-size:14px;line-height:20px;color:#111827;">
                  You have been invited to join <strong>${escapeHtml(tenantName)}</strong> as <strong>${escapeHtml(
                    input.roleName
                  )}</strong>.
                </p>

                ${departmentBlock}
                ${domainBlock}
                ${messageBlock}

                <div style="margin:0 0 14px 0;">
                  <a href="${escapeHtml(
                    input.acceptUrl
                  )}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;">
                    Accept invitation
                  </a>
                </div>

                <p style="margin:0 0 8px 0;font-size:13px;line-height:18px;color:#111827;font-weight:700;">What happens next</p>
                <ol style="margin:0 0 14px 18px;padding:0;font-size:13px;line-height:18px;color:#6b7280;">
                  <li style="margin:0 0 6px 0;">Click <strong>Accept invitation</strong>.</li>
                  <li style="margin:0 0 6px 0;">A <strong>temporary password</strong> will be shown once on the confirmation screen.</li>
                  <li style="margin:0 0 6px 0;">Login using your email address and the temporary password.</li>
                  <li style="margin:0;">You’ll be prompted to set a new password immediately after first login.</li>
                </ol>

                <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;color:#6b7280;">
                  Accept URL (copy/paste if button doesn't work):
                  <br />
                  <a href="${escapeHtml(
                    input.acceptUrl
                  )}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(
                    input.acceptUrl
                  )}</a>
                </p>

                <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;color:#6b7280;">
                  After accepting, you can login here:
                  <br />
                  <a href="${escapeHtml(
                    input.loginUrl
                  )}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(
                    input.loginUrl
                  )}</a>
                </p>

                <p style="margin:0 0 10px 0;font-size:12px;line-height:18px;color:#6b7280;">
                  Security note: This email contains a sign-in link. Please do not forward it.
                </p>

                <p style="margin:0;font-size:12px;line-height:18px;color:#6b7280;">
                  This invitation expires on <strong>${escapeHtml(
                    input.expiresAt.toDateString()
                  )}</strong>.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:10px 16px 0 16px;font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:11px;line-height:16px;text-align:center;">
                ${supportFooterBlock}
                © ${escapeHtml(currentYear)} ${escapeHtml(appName)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const deptText = input.departmentName ? `\nDepartment: ${input.departmentName}` : '';
  const domainText = input.tenantDomain ? `\nTenant domain: ${input.tenantDomain}` : '';
  const messageText = message ? `\n\nMessage from your department:\n${message}` : '';

  const greeting = inviteeFullName ? `Hi ${inviteeFullName},` : 'Hi,';

  const textContent = `${greeting}\n\nYou have been invited to join ${tenantName} as ${input.roleName}.${deptText}${domainText}${messageText}\n\nAccept invitation: ${input.acceptUrl}\n\nWhat happens next\n1) Click the accept link above.\n2) A temporary password will be shown once on the confirmation screen.\n3) Login using your email address and the temporary password: ${input.loginUrl}\n4) You’ll be prompted to set a new password immediately after first login.\n\nSecurity note: This email contains a sign-in link. Please do not forward it.\n\nThis invitation expires on ${input.expiresAt.toDateString()}.`;

  const templateParams: Record<string, unknown> = {
    ...input.commonTemplateParams,
    tenantName,
    tenantDomain: input.tenantDomain ?? undefined,
    inviteeFirstName: inviteeFirstName || undefined,
    inviteeLastName: inviteeLastName || undefined,
    inviteeFullName: inviteeFullName || undefined,
    roleName: input.roleName,
    departmentName: input.departmentName ?? undefined,
    acceptUrl: input.acceptUrl,
    loginUrl: input.loginUrl,
    expiresAt: input.expiresAt.toISOString(),
    expiresDate: input.expiresAt.toDateString(),
    subject,
    message: message || undefined,
  };

  return { subject, htmlContent, textContent, templateParams };
};
