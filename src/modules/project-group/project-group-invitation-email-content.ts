export type ProjectGroupInvitationEmailContentInput = {
  commonTemplateParams: Record<string, unknown>;
  inviteeName?: string;
  inviteeAvatarUrl?: string;
  leaderName?: string;
  leaderAvatarUrl?: string;
  groupName: string;
  groupDescription?: string;
  acceptUrl: string;
  rejectUrl: string;
  expiresAt: Date;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const buildProjectGroupInvitationEmailContent = (
  input: ProjectGroupInvitationEmailContentInput
): {
  subject: string;
  htmlContent: string;
  textContent: string;
  templateParams: Record<string, unknown>;
} => {
  const common = input.commonTemplateParams as Record<string, unknown>;
  const appName = String(common.appName ?? 'Academia');
  const logoUrl = common.logoUrl ? String(common.logoUrl) : undefined;
  const supportEmail = common.supportEmail ? String(common.supportEmail) : undefined;
  const defaultAvatarUrl = common.defaultAvatarUrl ? String(common.defaultAvatarUrl) : undefined;
  const currentYear = String(common.currentYear ?? new Date().getFullYear());

  const subject = `You have a group invitation: ${input.groupName}`;
  const inviteeName = (input.inviteeName ?? '').trim();
  const leaderName = (input.leaderName ?? '').trim();
  const inviteeAvatarUrl =
    (input.inviteeAvatarUrl ?? '').trim() ||
    defaultAvatarUrl ||
    'https://ui-avatars.com/api/?name=Student&background=2563eb&color=ffffff&size=128&bold=true';
  const leaderAvatarUrl =
    (input.leaderAvatarUrl ?? '').trim() ||
    defaultAvatarUrl ||
    'https://ui-avatars.com/api/?name=Leader&background=16a34a&color=ffffff&size=128&bold=true';
  const groupDescription = (input.groupDescription ?? '').trim();

  const headerLogoCell = logoUrl
    ? `<td style="vertical-align:middle;padding-right:10px;"><img src="${escapeHtml(logoUrl)}" width="28" height="28" alt="${escapeHtml(appName)}" style="display:block;border:0;outline:none;text-decoration:none;" /></td>`
    : '';

  const actionLogo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="18" height="18" alt="${escapeHtml(appName)}" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : '';

  const groupDescriptionBlock = groupDescription
    ? `<div style="font-size:13px;color:#6b7280;line-height:18px;margin-top:6px;">${escapeHtml(groupDescription)}</div>`
    : '';

  const supportBlock = supportEmail
    ? `Need help? Contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6b7280;text-decoration:underline;">${escapeHtml(supportEmail)}</a>.`
    : '';

  const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project group invitation</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:680px;max-width:680px;">
            <tr>
              <td style="padding:0 16px 12px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${headerLogoCell}
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:700;">${escapeHtml(appName)}</div>
                      <div style="font-size:12px;color:#6b7280;">Project Group Invitation</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border-radius:12px;padding:20px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <h1 style="margin:0 0 12px 0;font-size:18px;line-height:24px;">You've been invited to join a group</h1>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px 0;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:8px;"><img src="${escapeHtml(inviteeAvatarUrl)}" width="32" height="32" alt="Invitee" style="display:block;border:0;outline:none;text-decoration:none;border-radius:9999px;" /></td>
                    <td style="vertical-align:middle;font-size:14px;line-height:20px;color:#111827;">Hi <strong>${escapeHtml(inviteeName || 'Student')}</strong>,</td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px 0;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:8px;"><img src="${escapeHtml(leaderAvatarUrl)}" width="28" height="28" alt="Leader" style="display:block;border:0;outline:none;text-decoration:none;border-radius:9999px;" /></td>
                    <td style="vertical-align:middle;font-size:14px;line-height:20px;color:#111827;"><strong>${escapeHtml(leaderName || 'A group leader')}</strong> invited you to join their project group.</td>
                  </tr>
                </table>

                <div style="margin:0 0 16px 0;padding:12px 14px;background:#f3f4f6;border-radius:10px;">
                  <div style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">Group name</div>
                  <div style="font-size:15px;color:#111827;line-height:20px;font-weight:700;">${escapeHtml(input.groupName)}</div>
                  ${groupDescriptionBlock}
                </div>

                <div style="margin:0 0 14px 0;padding:10px 12px;background:#eff6ff;border-radius:8px;">
                  <span style="font-size:12px;color:#1e40af;font-weight:700;">Expires:</span>
                  <span style="font-size:12px;color:#1f2937;"> ${escapeHtml(input.expiresAt.toISOString())}</span>
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px 0;">
                  <tr>
                    <td style="padding:0 0 10px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:8px;">${actionLogo}</td>
                          <td style="vertical-align:middle;font-size:12px;color:#6b7280;font-weight:700;">Choose your action</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding-right:10px;">
                            <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;">Accept invitation</a>
                          </td>
                          <td>
                            <a href="${escapeHtml(input.rejectUrl)}" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;">Decline</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;color:#6b7280;">Accept: <a href="${escapeHtml(input.acceptUrl)}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${escapeHtml(input.acceptUrl)}</a></p>
                <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;color:#6b7280;">Decline: <a href="${escapeHtml(input.rejectUrl)}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${escapeHtml(input.rejectUrl)}</a></p>

                <p style="margin:0;font-size:12px;line-height:18px;color:#6b7280;">${supportBlock}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 16px 0 16px;font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:11px;line-height:16px;text-align:center;">© ${escapeHtml(currentYear)} ${escapeHtml(appName)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textContent = `Hi ${inviteeName || 'Student'},\n\n${leaderName || 'A group leader'} invited you to join the project group: ${input.groupName}.\n\nAccept: ${input.acceptUrl}\nDecline: ${input.rejectUrl}\n\nExpires: ${input.expiresAt.toISOString()}`;

  const templateParams: Record<string, unknown> = {
    ...input.commonTemplateParams,
    inviteeName: inviteeName || undefined,
    inviteeAvatarUrl,
    leaderName: leaderName || undefined,
    leaderAvatarUrl,
    groupName: input.groupName,
    groupDescription: groupDescription || undefined,
    acceptUrl: input.acceptUrl,
    rejectUrl: input.rejectUrl,
    expiresAt: input.expiresAt.toISOString(),
    subject,
  };

  return { subject, htmlContent, textContent, templateParams };
};
