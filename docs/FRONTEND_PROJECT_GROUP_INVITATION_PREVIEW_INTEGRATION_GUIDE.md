# Frontend Project-Group Invitation Preview Integration Guide

This guide is a practical one-by-one implementation flow for invitation preview + send.

## Scope

- Audience: approved Group Leaders (student role).
- Group status must be `DRAFT`.
- Preview endpoint does not send email.
- Send endpoint is the actual action that creates invitation + triggers email send.

## Step 0 — Prerequisites

Before implementation, confirm:
- Frontend can call authenticated API endpoints with access token.
- Invite screen already has a student picker (or can reuse available-students endpoint).
- UI has a modal/drawer area to show email preview.

## Step 1 — Collect required input

Required payload field:
- `invitedUserId` (UUID)

Client validation:
- Disable Preview/Send buttons if no selected student.

## Step 2 — Call preview endpoint

Endpoint:
- `POST /api/v1/project-groups/invitations/preview`

Request body:

```json
{
  "invitedUserId": "c4c25a9c-2f4a-4f60-8e8f-0dcf3ea1808e"
}
```

Success response shape:

```json
{
  "subject": "You have a group invitation: Smart Attendance System",
  "htmlContent": "<!doctype html>...",
  "textContent": "Hi John, ...",
  "templateParams": {
    "appName": "Academia",
    "logoUrl": "https://...",
    "defaultAvatarUrl": "https://.../default-avatar.png",
    "supportEmail": "support@academia.et",
    "currentYear": 2026,
    "inviteeName": "John Doe",
    "inviteeAvatarUrl": "https://.../invitee-avatar.png",
    "leaderName": "Leader Name",
    "leaderAvatarUrl": "https://.../leader-avatar.png",
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

## Step 3 — Render preview UI (read-only)

Render these elements:
- Subject (`subject`)
- HTML preview (`htmlContent`) in sandboxed iframe
- Optional text tab (`textContent`)
- Metadata (`expiresAt`, `templateId`)

Avatar expectation:
- UI should not build avatar URLs itself.
- Use backend-provided `inviteeAvatarUrl` and `leaderAvatarUrl` as-is.

## Step 4 — Confirm and send invitation

On **Send** click:
- `POST /api/v1/project-groups/invitations`

Request body:

```json
{
  "invitedUserId": "c4c25a9c-2f4a-4f60-8e8f-0dcf3ea1808e"
}
```

After success:
- Close preview modal.
- Show success toast.
- Refresh group/invitation state.

## Step 5 — Error handling map

Handle and map these server messages:
- `You cannot invite yourself`
- `Invited student not found`
- `Invited student must be in the same department`
- `Invited user is not a student`
- `Invited student is already a group leader`
- `Invited student has already joined a group`
- `Group is not accepting invitations`
- `Group has reached the maximum size`

UX recommendation:
- Show server message directly for now.
- Add i18n mapping layer later if needed.

## Step 6 — End-to-end frontend sequence

1. User selects student.
2. Clicks Preview.
3. Frontend calls preview endpoint.
4. Frontend shows preview modal with HTML and metadata.
5. User clicks Send.
6. Frontend calls send endpoint.
7. UI confirms success and refreshes state.

## Step 7 — QA checklist (must pass)

- Preview opens and renders HTML correctly.
- Invitee avatar appears when invitee has profile avatar.
- Leader avatar appears when leader has profile avatar.
- Fallback avatar appears when either avatar is missing.
- Send succeeds after preview without page refresh.
- Error messages display correctly for invalid invite targets.

## Minimal TypeScript helpers

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
