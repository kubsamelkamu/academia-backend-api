# Frontend Proposal Rejection Reminder Integration Guide

This guide covers the rejected-proposal reminder flow that starts after a proposal is rejected and a Coordinator or Department Head sets a resubmission deadline for the project group.

## Scope

- Reminder creation by `COORDINATOR` or `DEPARTMENT_HEAD`
- Group-visible countdown on the student dashboard
- In-app notifications for reminder creation, 24h reminder, 1h reminder, and deadline passed
- Informational reminder emails for 24h, 1h, and deadline-passed events

## Base

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <token>`

## 1) Create a proposal rejection reminder

- `POST /projects/proposals/:id/rejection-reminder`
- Roles: `COORDINATOR`, `DEPARTMENT_HEAD`

Request body:

```json
{
  "title": "Proposal Resubmission Reminder",
  "message": "Please revise the scope and citations before resubmitting.",
  "deadlineAt": "2026-04-10T12:00:00.000Z",
  "disableAfterDeadline": true
}
```

Rules:

- Proposal must already be `REJECTED`.
- Proposal must belong to an approved project group.
- `deadlineAt` must be a future ISO datetime.
- Only one active reminder can exist for the rejected proposal at a time.

Response fields used by frontend:

- `id`
- `proposalId`
- `projectGroupId`
- `title`
- `message`
- `kind` = `PROPOSAL_REJECTION_REMINDER`
- `priority`
- `deadlineAt`
- `disableAfterDeadline`
- `expiredAt`
- `createdAt`
- `updatedAt`

## 2) Student dashboard announcement source

Students read reminder announcements from the existing project-group announcements endpoint:

- `GET /project-groups/me/announcements?page=1&limit=20`

The rejected-proposal reminder is returned in the same list as other project-group announcements.

Reminder-specific fields to use:

- `proposalId`
- `kind`
- `deadlineAt`
- `disableAfterDeadline`
- `expiredAt`
- `isExpired`
- `isDisabled`
- `secondsRemaining`

Frontend filtering recommendation:

- To render a dedicated rejected-proposal reminder card, filter where `kind === 'PROPOSAL_REJECTION_REMINDER'`.
- If you also show a general announcements feed, keep the reminder in both places or mark it visually as high priority.

## 3) Countdown behavior

Use backend fields as the source of truth.

- If `deadlineAt` is `null`, do not render a countdown.
- If `secondsRemaining > 0`, show a live countdown.
- If `secondsRemaining === 0` or `isExpired === true`, show `Deadline passed`.
- If `isDisabled === true`, disable resubmission CTA or related quick actions tied to that reminder card.

Recommended countdown conversion:

```ts
export function toCountdownParts(totalSeconds: number | null) {
  if (totalSeconds === null || totalSeconds <= 0) return null;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}
```

## 4) Realtime refresh behavior

Realtime reminder updates are delivered through the existing project-group announcement channel.

Socket event:

- `project-group-announcement`

Payload shape:

```json
{
  "type": "created | updated | deleted",
  "announcementId": "uuid",
  "announcement": {
    "id": "uuid",
    "kind": "PROPOSAL_REJECTION_REMINDER",
    "secondsRemaining": 86399,
    "isExpired": false,
    "isDisabled": false
  }
}
```

Frontend behavior:

- `created`: prepend or merge reminder card
- `updated`: replace the current reminder item and reset local countdown
- `deleted`: remove the card
- safest fallback: refetch `GET /project-groups/me/announcements`

## 5) Notification events used in this flow

In-app notification event names:

- `PROPOSAL_RESUBMISSION_REMINDER_CREATED`
- `PROPOSAL_RESUBMISSION_REMINDER_24H`
- `PROPOSAL_RESUBMISSION_REMINDER_1H`
- `PROPOSAL_RESUBMISSION_REMINDER_DEADLINE_PASSED`

Recommended frontend mapping:

- `CREATED`: show a high-priority dashboard notification and badge the reminder card
- `24H`: show `deadline approaching` state
- `1H`: show `final reminder` state
- `DEADLINE_PASSED`: show expired state and disable reminder-specific action affordances

## 6) Email behavior

Backend sends informational-only emails to the proposal group for:

- 24-hour reminder window
- 1-hour reminder window
- deadline passed event

Important:

- These emails do not contain action buttons.
- The frontend should treat the dashboard and proposal page as the source of truth.
- If email content and live status differ, trust the API response and realtime payloads.

## 7) Suggested UI composition

For the student dashboard:

- Show a dedicated `Proposal Resubmission Reminder` card when an active reminder exists.
- Include `title`, `message`, countdown, and expired state.
- Link the card to proposal details or proposal feedback history if your UI already exposes those pages.

For proposal details page:

- Show reminder metadata near the rejection feedback timeline.
- Reuse the same countdown state from the announcements API if you already fetch it on dashboard.

## 8) Error mapping

- `400` -> invalid deadline or invalid group state
- `403` -> user is not allowed to create the reminder
- `404` -> proposal not found
- `409` -> proposal is not rejected, or an active reminder already exists
