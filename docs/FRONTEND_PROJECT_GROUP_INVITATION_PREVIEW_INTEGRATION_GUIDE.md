# Frontend Project-Group Invitation Preview Integration Guide

This guide explains, step-by-step, how Group Leaders can preview an invitation email before sending it.

## Scope / Rules

- Feature is for users with `STUDENT` role who are approved Group Leaders.
- Group must be in `DRAFT` status to preview/send invitations.
- Preview does not send email; it only returns email content.
- Send action is still a separate API call.

## Step 1 — Let Group Leader select a student to invite

In your invite UI, collect one required value:
- `invitedUserId` (UUID)

Use your existing available-students list endpoint to populate the picker.

## Step 2 — Call preview API before send

**Request**
- `POST /api/v1/project-groups/invitations/preview`
- Auth: Bearer access token
- Body:

```json
{
  "invitedUserId": "c4c25a9c-2f4a-4f60-8e8f-0dcf3ea1808e"
}
```

**Success response (example)**

```json
{
  "subject": "You have a group invitation: Smart Attendance System",
  "htmlContent": "<!doctype html>...",
  "textContent": "Hi John, ...",
  "templateParams": {
    "appName": "Academia",
    "logoUrl": "https://...",
    "supportEmail": "support@academia.et",
    "currentYear": 2026,
    "inviteeName": "John Doe",
    "inviteeAvatarUrl": "https://.../avatar-invitee.png",
    "leaderName": "Leader Name",
    "leaderAvatarUrl": "https://.../avatar-leader.png",
    "groupName": "Smart Attendance System",
    "acceptUrl": "https://api.../project-groups/invitations/accept/ui?token=preview-token",
    "rejectUrl": "https://api.../project-groups/invitations/reject/ui?token=preview-token",
    "expiresAt": "2026-03-20T11:45:00.000Z"
  },
  "acceptUrl": "https://api.../project-groups/invitations/accept/ui?token=preview-token",
  "rejectUrl": "https://api.../project-groups/invitations/reject/ui?token=preview-token",
  "expiresAt": "2026-03-20T11:45:00.000Z",
  "templateId": 123
}
```

## Step 3 — Render preview UI

Recommended UI blocks:
- Subject line from `subject`
- HTML preview pane from `htmlContent`
- Plain-text fallback tab from `textContent`
- Metadata row: `expiresAt` and `templateId`

Rendering recommendation:
- Prefer rendering `htmlContent` in a sandboxed iframe preview panel.
- Keep this as read-only preview; do not edit HTML client-side.

## Step 4 — Confirm and send invitation

When the Group Leader clicks **Send**:

**Request**
- `POST /api/v1/project-groups/invitations`
- Body:

```json
{
  "invitedUserId": "c4c25a9c-2f4a-4f60-8e8f-0dcf3ea1808e"
}
```

**Expected behavior**
- Invitation record is created.
- Email send is best-effort (queued or direct send based on environment).

## Step 5 — Handle common errors in frontend

Map backend errors to friendly messages:
- `You cannot invite yourself`
- `Invited student not found`
- `Invited student must be in the same department`
- `Invited user is not a student`
- `Invited student is already a group leader`
- `Invited student has already joined a group`
- `Group is not accepting invitations`
- `Group has reached the maximum size`

## Step 6 — Minimal frontend flow (one by one)

1. User picks student.
2. Frontend calls preview API.
3. Frontend shows preview modal/drawer.
4. User confirms send.
5. Frontend calls send API.
6. Frontend shows success toast and refreshes invite/member state.

## Quick TypeScript example

```ts
type PreviewResponse = {
  subject: string;
  htmlContent: string;
  textContent: string;
  templateParams: Record<string, unknown>;
  acceptUrl: string;
  rejectUrl: string;
  expiresAt: string;
  templateId: number | null;
};

export async function previewGroupInvitationEmail(invitedUserId: string): Promise<PreviewResponse> {
  const res = await fetch('/api/v1/project-groups/invitations/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitedUserId }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Failed to preview invitation email');
  }

  return res.json();
}

export async function sendGroupInvitation(invitedUserId: string) {
  const res = await fetch('/api/v1/project-groups/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitedUserId }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Failed to send invitation');
  }

  return res.json();
}
```
