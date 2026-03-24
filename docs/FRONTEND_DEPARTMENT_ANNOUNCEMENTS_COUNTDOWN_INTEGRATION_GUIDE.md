# Frontend Department Announcements Countdown Integration Guide

This guide explains how to integrate department announcements with optional deadlines and student countdown UI.

If you also need the Coordinator/Department Head UI (create/edit/delete announcements), see:

- `FRONTEND_DEPARTMENT_ANNOUNCEMENTS_MANAGEMENT_UI_GUIDE.md`

## Feature summary

- `Coordinator` and `Department Head` can create announcements.
- `Student` (and other department users) can read announcements.
- Announcement can include optional `deadlineAt`.
- Backend returns countdown-ready fields.
- Backend sends in-app notifications:
  - on creation
  - at 24h reminder window (or late catch-up)
  - at 1h reminder window
  - when deadline is passed
- Realtime socket event is emitted for create/update/delete.

---

## REST API

Base path: `/api/v1/departments/:departmentId/announcements`

### 1) Create announcement

- Method: `POST`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Request body:

```json
{
  "title": "Form Project Group",
  "message": "Please form your project groups within 3 days.",
  "actionType": "FORM_PROJECT_GROUP",
  "actionLabel": "Form Group",
  "actionUrl": "https://your-frontend-url/groups/form",
  "deadlineAt": "2026-03-24T12:00:00.000Z"
}
```

`actionType` enum:

- `FORM_PROJECT_GROUP`
- `SUBMIT_PROPOSAL`
- `UPLOAD_DOCUMENT`
- `REGISTER_PRESENTATION`
- `CUSTOM_ACTION`

### 2) List announcements

- Method: `GET`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`
- Query params:
  - `page` (default `1`)
  - `limit` (default `20`, max `100`)

### 3) Get one announcement

- Method: `GET /:announcementId`
- Same read roles as list

### 4) Update announcement

- Method: `PATCH /:announcementId`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Update body supports:

- `title`, `message`, `actionType`, `actionLabel`, `actionUrl`, `deadlineAt`
- `clearDeadline: true` to remove existing deadline

### 5) Delete announcement

- Method: `DELETE /:announcementId`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

---

## Countdown fields in response

Each announcement item includes:

- `deadlineAt: string | null`
- `isExpired: boolean`
- `isDisabled: boolean`
- `secondsRemaining: number | null`

Frontend display recommendation:

- If `deadlineAt` is `null`: hide countdown.
- If `secondsRemaining > 0`: render `d h m` countdown.
- If `secondsRemaining === 0` or `isExpired === true`: show `Deadline passed` and disable action button.

---

## Reminder behavior

For announcements with deadline:

- Reminder 24h before deadline.
- Reminder 1h before deadline.
- If created inside 24h window, backend sends 24h **late catch-up** reminder.
- On deadline pass, announcement is marked expired (`expiredAt`) when `disableAfterDeadline=true`.

---

## Realtime contract

Socket namespace: `/notifications`

Event emitted by backend: `department-announcement`

Payload:

```json
{
  "type": "created | updated | deleted",
  "announcementId": "uuid",
  "announcement": { "...": "announcement object for created/updated" }
}
```

Frontend behavior:

- `created`: prepend item
- `updated`: replace by `announcementId`
- `deleted`: remove by `announcementId`
- safest fallback: refetch `GET /departments/:departmentId/announcements`

---

## Student Deadline Card (Step-by-step)

This section is the implementation plan for student UI, one step at a time.

### Step 1 — Data fetch in Student Dashboard

Call:

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`

Store `data.items` as source state for the deadline card list.

Minimum fields used by UI:

- `id`, `title`, `message`
- `actionType`, `actionLabel`, `actionUrl`
- `deadlineAt`, `secondsRemaining`, `isExpired`, `isDisabled`
- `createdBy.firstName`, `createdBy.lastName`

### Step 2 — Convert `secondsRemaining` to d/h/m/s

Use this deterministic conversion:

```ts
type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function toCountdownParts(totalSeconds: number | null): CountdownParts | null {
  if (totalSeconds === null || totalSeconds <= 0) return null;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}
```

Display format recommendation:

- `2d 10h 15m 08s`
- always show seconds with leading zero (`08s`)

### Step 3 — Interactive countdown tick (every second)

- Keep local `uiSecondsRemaining` initialized from backend `secondsRemaining`.
- Use a 1-second interval to decrement locally for smooth UX.
- Never decrement below `0`.
- When it reaches `0`, switch card to expired UI immediately.

Suggested behavior:

- card status text: `Deadline passed`
- primary action button: disabled
- keep announcement visible for reference

### Step 4 — Re-sync with backend to avoid drift

Because client clocks can differ, re-fetch list periodically:

- Re-fetch every `60s` while dashboard is open.
- Also re-fetch on tab refocus.
- Backend values are source of truth if local and server differ.

### Step 5 — Realtime updates

Listen to socket event `department-announcement`.

- `created`: prepend new card
- `updated`: replace card by `announcementId` and reset local countdown from new `secondsRemaining`
- `deleted`: remove card

Fallback: if event payload is incomplete, call list endpoint again.

### Step 6 — Card interaction rules

If `isDisabled === false` and `actionUrl` exists:

- make CTA clickable
- CTA label priority:
  1. `actionLabel`
  2. fallback by `actionType` (e.g. `FORM_PROJECT_GROUP` → `Form Group`)

If `isDisabled === true`:

- disable CTA button
- keep card content readable

If `actionUrl` is `null`:

- show non-link CTA or hide button based on product decision

### Step 7 — Reminder/notification UX in student side

Use notifications endpoint:

- `GET /api/v1/notifications?limit=50`

Watch for events:

- `DEPARTMENT_ANNOUNCEMENT_CREATED`
- `DEPARTMENT_ANNOUNCEMENT_DEADLINE_24H`
- `DEPARTMENT_ANNOUNCEMENT_DEADLINE_1H`
- `DEPARTMENT_ANNOUNCEMENT_DEADLINE_PASSED`

On these events, show toast and optionally refetch announcements.

### Step 8 — Acceptance checklist (Student Deadline Card)

- [ ] Student sees announcement list in dashboard
- [ ] Countdown renders as `d h m s`
- [ ] Countdown updates every second without page refresh
- [ ] Expired state is shown when timer reaches zero
- [ ] CTA disabled when `isDisabled=true`
- [ ] Realtime create/update/delete updates cards correctly
- [ ] Notification events appear for created/24h/1h/passed

---

## Suggested implementation order for your team

1. Fetch + render static cards (no live tick)
2. Add `secondsRemaining` conversion helper
3. Add 1-second local countdown tick
4. Add expired/disabled UI state
5. Add 60-second backend resync
6. Add websocket realtime handling
7. Add notification toast integration
