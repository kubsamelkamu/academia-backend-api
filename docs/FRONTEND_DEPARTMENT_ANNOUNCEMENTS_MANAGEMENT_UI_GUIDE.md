# Frontend Department Announcements Management UI Guide (Coordinator + Department Head)

This guide explains how to implement the **Coordinator** and **Department Head** user interface for managing department announcements (create, edit, delete) using the backend Department Announcements API.

If you already implemented the student countdown card, see:

- `FRONTEND_DEPARTMENT_ANNOUNCEMENTS_COUNTDOWN_INTEGRATION_GUIDE.md`

---

## Feature summary

- Roles that can **manage** announcements: `DEPARTMENT_HEAD`, `COORDINATOR`
- Roles that can **read** announcements: `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`
- Announcements support:
  - `title` + `message`
  - optional CTA (`actionLabel`, `actionUrl`) shown to students
  - optional `deadlineAt` (ISO string)
- Backend returns countdown-ready fields for all readers:
  - `deadlineAt: string | null`
  - `secondsRemaining: number | null`
  - `isExpired: boolean`
  - `isDisabled: boolean`
- Backend emits realtime socket events to department students on create/update/delete:
  - event name: `department-announcement`

---

## REST API mapping

Base path:

- `/api/v1/departments/:departmentId/announcements`

### Create announcement

- `POST /api/v1/departments/:departmentId/announcements`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Body:

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

### List announcements

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`

### Get one announcement

- `GET /api/v1/departments/:departmentId/announcements/:announcementId`
- Roles: same as list

### Update announcement

- `PATCH /api/v1/departments/:departmentId/announcements/:announcementId`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Update body supports any subset of:

- `title`, `message`, `actionType`, `actionLabel`, `actionUrl`, `deadlineAt`
- `clearDeadline: true` to remove an existing deadline

### Delete announcement

- `DELETE /api/v1/departments/:departmentId/announcements/:announcementId`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

---

## Important backend rules to reflect in UI

### 1) Deadline must be in the future

Backend rejects past deadlines:

- `deadlineAt must be in the future`

UI recommendation:

- Validate `deadlineAt` client-side (disable submit if deadline <= now)
- Still handle backend error gracefully (backend is source of truth)

### 2) Optional fields behavior

- If `actionLabel` is empty string, do not send it (or send `null`/omit) to avoid confusion.
- If `actionUrl` is provided, it must be a valid URL with protocol, e.g. `https://...`
- If you want a CTA, prefer requiring both `actionLabel` and `actionUrl` in the UI.

### 3) Updating deadlines resets reminder state

When updating deadline or clearing it, backend resets:

- `expiredAt`, `reminder24hSentAt`, `reminder1hSentAt`

This means:

- Editing deadline “restarts” the reminder workflow.

---

## Suggested UI screens (Coordinator + Department Head)

Implement the simplest UI that covers these flows.

### Screen A — Announcements list page

Purpose:

- Show existing announcements
- Provide “Create announcement” action
- Allow edit/delete for your own department

Recommended list item UI:

- Title + message preview
- “Created by” (firstName + lastName) and created date
- Optional deadline display:
  - If `deadlineAt` exists, show a countdown badge using `secondsRemaining`
  - If `isExpired` true, show status `Expired`
- Optional CTA preview:
  - show `actionLabel` + `actionUrl` (as plain text or clickable for preview)

Data fetch:

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`

State update behavior:

- After create/update/delete, update local list immediately (optimistic or refetch)
- If you are already listening to realtime updates for students, you can ignore it here (backend emits to students, not necessarily to the author)

### Screen B — Create announcement form

Fields:

- `title` (required, max 255)
- `message` (required, max 5000)
- `actionType` (required enum)
- `actionLabel` (optional, max 120)
- `actionUrl` (optional, must be valid URL with protocol)
- `deadlineAt` (optional)

Date input recommendation:

- Use a datetime picker that outputs a real `Date` object.
- Convert to ISO before sending:
  - `deadlineAt: selectedDate.toISOString()`

Submission:

- Call `POST /api/v1/departments/:departmentId/announcements`
- On success:
  - show toast: `Announcement created`
  - insert the returned announcement at top of list

### Screen C — Edit announcement form

Flow:

- Start from existing announcement data.
- Option 1: Prefill from list item data.
- Option 2: Fetch fresh:
  - `GET /api/v1/departments/:departmentId/announcements/:announcementId`

When saving:

- Call `PATCH /api/v1/departments/:departmentId/announcements/:announcementId`
- If user removed a deadline:
  - send `{ "clearDeadline": true }`

Important:

- If user changes deadline to a new value, send `deadlineAt` (ISO string)
- If user didn’t touch deadline, omit both `deadlineAt` and `clearDeadline`

### Screen D — Delete confirmation

Flow:

- Show confirm dialog: `Delete this announcement?`
- On confirm:
  - call `DELETE /api/v1/departments/:departmentId/announcements/:announcementId`
  - remove the item from UI on success

---

## Error handling contract (frontend)

Backend uses a consistent wrapper. Practical rule:

- Success payload is at `response.data.data`
- Error user-facing message is typically `error.response.data.message`

Common errors to map nicely:

- `403` / `Access denied to department`
  - show: `You do not have access to this department.`
- `400` / `deadlineAt must be in the future`
  - show field error on deadline input
- `400` / `actionUrl must be a valid URL`
  - show field error on URL input
- `404` / `Announcement not found`
  - show: `Announcement no longer exists` and refetch list

---

## Realtime contract (for student side)

Socket namespace: `/notifications`

Event emitted: `department-announcement`

Payload:

```json
{
  "type": "created | updated | deleted",
  "announcementId": "uuid",
  "announcement": { "...": "announcement object for created/updated" }
}
```

If your coordinator/head UI also wants live updates:

- safest approach: after any event, refetch the list

---

## Acceptance checklist (Coordinator + Department Head)

- [ ] Can view department announcements list
- [ ] Can create announcement (required fields validated)
- [ ] Can set optional deadline and it must be future
- [ ] Can edit announcement and update/clear deadline correctly
- [ ] Can delete announcement and UI removes it
- [ ] Errors are displayed with clear user messages
