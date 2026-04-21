# Frontend Student Department Announcements Integration Guide

This guide explains, step-by-step, how to integrate department announcements into the Student Dashboard.

It is focused on the student read flow for:

- `GET /api/v1/departments/:departmentId/announcements`

The goal is to help you implement a clean student announcement area with deadline countdowns, action buttons, realtime updates, and safe UI handling.

## Scope

This guide is for:

- logged-in student users
- Student Dashboard announcement widgets, cards, or list pages
- department-level announcements created by `DEPARTMENT_HEAD` or `COORDINATOR`
- optional deadline countdown rendering

Important:

- The endpoint requires a valid JWT access token.
- The student must belong to the same department as `departmentId`.
- Backend returns countdown-ready fields for each announcement item.
- Expired announcements can still be returned by the API, so the frontend should not assume expired items are hidden.

## Related backend/frontend docs

- `FRONTEND_DEPARTMENT_ANNOUNCEMENTS_COUNTDOWN_INTEGRATION_GUIDE.md`
- `FRONTEND_DEPARTMENT_ANNOUNCEMENTS_MANAGEMENT_UI_GUIDE.md`

## Base URL and auth

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <accessToken>`

Global success response shape used by this backend:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-20T10:00:00.000Z"
}
```

In the examples below, announcement payloads are shown as the inner `data` object for readability. In your frontend, read the actual payload from `response.data.data` if your HTTP layer exposes the full wrapped response.

---

## 1) What the endpoint does

Endpoint:

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`

This endpoint returns a paginated list of department announcements ordered by newest first.

Each item can include:

- announcement content
- creator information
- optional action link/button metadata
- optional deadline
- computed countdown/status fields

Backend-computed countdown fields:

- `deadlineAt: string | null`
- `secondsRemaining: number | null`
- `isExpired: boolean`
- `isDisabled: boolean`

Practical meaning:

- if `deadlineAt` is `null`, there is no countdown
- if `secondsRemaining > 0`, show a live countdown
- if `secondsRemaining === 0` or `isExpired === true`, show expired UI and disable the CTA when appropriate

---

## 2) Recommended Student Dashboard flow

### Step 1 — Keep student context after login

From your auth/session state, keep:

- `accessToken`
- `user.id`
- `user.departmentId`

Use `user.departmentId` as the `departmentId` route parameter.

Important:

- Do not let students fetch another department's announcements.
- If `departmentId` is missing in auth state, do not call the endpoint until user context is loaded.

### Step 2 — Fetch announcements on dashboard load

Call:

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`

Recommended first-load behavior:

1. Start with `page=1` and `limit=20`.
2. Show skeleton cards while loading.
3. Save `items` and `pagination` into dashboard state.

Example request:

```http
GET /api/v1/departments/9e5f2dd3-6171-4f89-bd6d-7d47fd2ef9a4/announcements?page=1&limit=20
Authorization: Bearer <accessToken>
```

### Step 3 — Normalize the response into frontend state

Expected inner payload shape:

```json
{
  "items": [
    {
      "id": "e6b89fb6-8208-4489-92a7-e4c987d3b274",
      "tenantId": "tenant_uuid",
      "departmentId": "department_uuid",
      "createdByUserId": "user_uuid",
      "title": "Capstone II Defense Registration",
      "message": "All students must complete defense registration before the deadline.",
      "actionType": "CAPSTONE_II_DEFENSE",
      "actionLabel": "Open Registration",
      "actionUrl": "https://your-frontend-url/defense/register",
      "deadlineAt": "2026-04-25T12:00:00.000Z",
      "disableAfterDeadline": true,
      "expiredAt": null,
      "createdAt": "2026-04-20T08:00:00.000Z",
      "updatedAt": "2026-04-20T08:00:00.000Z",
      "createdBy": {
        "id": "creator_uuid",
        "firstName": "Meron",
        "lastName": "Kassa",
        "avatarUrl": null
      },
      "isExpired": false,
      "isDisabled": false,
      "secondsRemaining": 432000
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

Recommended local shape:

```ts
export type StudentDepartmentAnnouncement = {
  id: string;
  title: string;
  message: string;
  actionType: string;
  actionLabel: string | null;
  actionUrl: string | null;
  deadlineAt: string | null;
  disableAfterDeadline: boolean;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  isExpired: boolean;
  isDisabled: boolean;
  secondsRemaining: number | null;
};
```

### Step 4 — Render the announcement cards

For each item, show at least:

- `title`
- `message`
- creator display name
- created date
- action button if `actionLabel` and `actionUrl` exist
- countdown/status badge if `deadlineAt` exists

Suggested card layout:

1. Title row
2. Message body
3. Metadata row:
   - creator name
   - created date
   - status badge
4. Countdown row if deadline exists
5. CTA button row if action exists

Recommended status badge rules:

- `isExpired === true` -> `Expired`
- `deadlineAt !== null` and `isExpired === false` -> `Active deadline`
- `deadlineAt === null` -> no badge or `Open`

### Step 5 — Convert `secondsRemaining` into dashboard countdown text

Use a deterministic helper:

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

Display recommendation:

- `2d 04h 15m 09s`
- keep seconds zero-padded when displayed

### Step 6 — Keep the countdown moving locally

For smooth UX, initialize local display state from backend `secondsRemaining` and decrement once per second in the UI.

Important rules:

- never decrement below `0`
- when local countdown reaches `0`, immediately switch the card into expired UI
- backend remains the source of truth, so periodic refetch is still required

Recommended local behavior:

```ts
const nextSeconds = currentSeconds === null ? null : Math.max(0, currentSeconds - 1);
```

### Step 7 — Disable expired CTA actions correctly

Use these rules when rendering the action button:

1. If `actionUrl` is missing, do not render the CTA button.
2. If `isDisabled === true`, render the button disabled.
3. If `isExpired === true`, show `Deadline passed` text near the CTA.
4. If `isDisabled === false` and `actionUrl` exists, render a normal button or link.

Recommended action label fallback:

- If `actionLabel` is missing but `actionUrl` exists, use `Open`.

### Step 8 — Re-sync with the backend to avoid timer drift

Client clocks are not always accurate. Re-fetch the list periodically.

Recommended refetch rules:

- re-fetch every `60s` while the dashboard is open
- re-fetch when browser tab regains focus
- re-fetch after network reconnect

If server values differ from local countdown state, trust the backend values.

### Step 9 — Handle realtime updates in the dashboard

The backend emits realtime notification events using the `/notifications` namespace.

Event name:

- `department-announcement`

Expected payload:

```json
{
  "type": "created",
  "announcementId": "uuid",
  "announcement": {
    "id": "uuid",
    "title": "New announcement"
  }
}
```

Frontend behavior:

- `created`: prepend the new announcement card
- `updated`: replace the matching card by `announcementId`
- `deleted`: remove the matching card by `announcementId`

Safest fallback:

- if payload is partial or your socket state is stale, re-fetch `GET /api/v1/departments/:departmentId/announcements`

### Step 10 — Add pagination or a "View all" page if needed

The endpoint returns:

- `pagination.total`
- `pagination.page`
- `pagination.limit`
- `pagination.pages`

For the Student Dashboard, a good pattern is:

1. show latest `5` to `10` announcements in a compact widget, or fetch `20` and visually truncate
2. provide `View all announcements`
3. on the full page, use the same endpoint with page controls

---

## 3) Recommended UI states

### State A — Loading

Show:

- skeleton announcement cards
- muted placeholder for countdown and CTA

### State B — Empty list

Condition:

- `items.length === 0`

Show:

- empty-state card
- message such as `No department announcements yet.`

### State C — Active announcements available

Show:

- normal list of cards
- countdown where applicable
- enabled CTA when not disabled

### State D — Expired announcement

Show:

- expired badge
- `Deadline passed`
- disabled CTA if action is time-limited

Keep expired items visible unless product requirements explicitly hide them.

### State E — Unauthorized or access mismatch

Possible backend response:

- `403 Forbidden`

Typical reasons:

- student is not assigned to a department
- `departmentId` does not match the student's department
- tenant/department access mismatch

Frontend handling:

- do not keep retrying silently
- show a friendly error state
- optionally redirect back to the main dashboard shell and refresh user context

### State F — Token expired

Possible backend response:

- `401 Unauthorized`

Frontend handling:

- trigger your refresh-token flow or logout flow

---

## 4) Suggested minimal component structure

Recommended Student Dashboard composition:

1. `StudentAnnouncementsSection`
2. `StudentAnnouncementCard`
3. `AnnouncementCountdown`
4. `AnnouncementActionButton`

Example responsibility split:

- `StudentAnnouncementsSection`: fetch, pagination, socket refresh, loading/error states
- `StudentAnnouncementCard`: render title/message/meta/status
- `AnnouncementCountdown`: local one-second countdown display
- `AnnouncementActionButton`: CTA enabled/disabled rules

---

## 5) Suggested frontend checklist

- [ ] read `departmentId` from logged-in student context
- [ ] fetch `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`
- [ ] unwrap backend `data` payload correctly
- [ ] render title, message, creator, created date
- [ ] show countdown only when `deadlineAt` exists
- [ ] decrement countdown locally every second
- [ ] disable CTA when `isDisabled === true`
- [ ] show `Deadline passed` when expired
- [ ] listen to realtime `department-announcement` events
- [ ] re-fetch periodically to correct clock drift
- [ ] handle `401`, `403`, empty state, and deleted announcements safely

---

## 6) Recommended first implementation order

If you want to build this in the safest order, do it like this:

1. Implement basic fetch + list rendering
2. Add empty/loading/error states
3. Add countdown badge from backend `secondsRemaining`
4. Add local per-second countdown tick
5. Add CTA disable rules
6. Add socket realtime updates
7. Add full-page pagination or `View all`

That order keeps the Student Dashboard usable early, before you add the more dynamic behavior.