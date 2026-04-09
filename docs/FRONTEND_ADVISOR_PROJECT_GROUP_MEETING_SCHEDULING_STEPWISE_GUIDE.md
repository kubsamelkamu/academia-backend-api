# Frontend Advisor Project-Group Meeting Scheduling Stepwise Guide

This guide explains how to integrate **Advisor -> Project Group Meeting Scheduling** in a stepwise way.

Feature summary:
- Advisor selects a supervised project.
- Advisor schedules a meeting by providing:
  - projectId
  - title
  - meetingAt (date/time)
  - durationMinutes
  - agenda
- Backend notifies project-group students (leader + members, excluding scheduler).
- Advisor dashboard can show full meeting history for the selected project.
- Students can view meeting history from their own dashboard.

---

## 1) REST API (Advisor)

Base path:
- `/api/v1/project-groups/advisors/me/meetings`

Auth:
- Bearer JWT
- Role: `ADVISOR`

Scope rule:
- Advisor endpoints require `projectId` and only work for projects advised by current advisor.
- Backend resolves `projectId -> proposal -> projectGroup` and requires project-group status `APPROVED`.

---

## 2) Stepwise implementation

### Step 1 - Load advisor projects for selector

Call:
- `GET /api/v1/projects/advisors/me/projects`

Frontend:
- Render project dropdown.
- Save selected value as `selectedProjectId`.

---

### Step 2 - Schedule a meeting

Call:
- `POST /api/v1/project-groups/advisors/me/meetings`

Request body:
```json
{
  "projectId": "<selectedProjectId>",
  "title": "Weekly Progress Check",
  "meetingAt": "2026-04-15T13:30:00.000Z",
  "durationMinutes": 60,
  "agenda": "Milestone status, blockers, and next sprint tasks."
}
```

Validation notes:
- `meetingAt` must be a valid future ISO datetime.
- `durationMinutes` must be at least 15.
- `title` max length: 255.
- `agenda` max length: 5000.

Response data (important fields):
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectGroupId": "uuid",
  "title": "Weekly Progress Check",
  "meetingAt": "2026-04-15T13:30:00.000Z",
  "durationMinutes": 60,
  "agenda": "Milestone status, blockers, and next sprint tasks.",
  "endsAt": "2026-04-15T14:30:00.000Z",
  "isUpcoming": true,
  "isOngoing": false,
  "isCompleted": false,
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "createdBy": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "avatarUrl": "string|null"
  }
}
```

Frontend action:
- Prepend newly scheduled meeting to local list.

---

### Step 3 - Show advisor meeting history

Call:
- `GET /api/v1/project-groups/advisors/me/meetings?projectId=<selectedProjectId>&page=1&limit=20`

Response shape:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Weekly Progress Check",
        "meetingAt": "ISO",
        "durationMinutes": 60,
        "agenda": "string",
        "endsAt": "ISO",
        "isUpcoming": true,
        "isOngoing": false,
        "isCompleted": false,
        "createdBy": {
          "id": "uuid",
          "firstName": "string",
          "lastName": "string",
          "avatarUrl": "string|null"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

UI recommendation:
- Split into two tabs using client-side filter:
  - Upcoming: `isUpcoming || isOngoing`
  - History: `isCompleted`

---

### Step 4 - Meeting details view (advisor)

Call:
- `GET /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<selectedProjectId>`

Use this endpoint for details modal/page when user clicks one meeting row.

---

## 3) Student integration (meeting history)

Student list endpoint:
- `GET /api/v1/project-groups/me/meetings?page=1&limit=20`

Student details endpoint:
- `GET /api/v1/project-groups/me/meetings/:meetingId`

These are scoped to the logged-in student's approved project group.

---

## 4) Notification and realtime behavior

### In-app notifications
When advisor schedules a meeting, backend creates in-app notifications for project-group students.

Notification event type:
- `PROJECT_GROUP_MEETING_SCHEDULED`

Recommended frontend handling:
- Refresh notification list/unread badge.
- If user is on meetings page, optionally refresh meeting list.

### Realtime socket event
Namespace:
- `/notifications`

Event name:
- `project-group-meeting`

Payload:
```json
{
  "type": "scheduled",
  "projectGroupId": "uuid",
  "projectId": "uuid",
  "meetingId": "uuid",
  "meeting": { "...": "meeting object" },
  "occurredAt": "ISO timestamp"
}
```

Recommended behavior:
- On `scheduled`, prepend `meeting` if not already in list.
- If uncertain, refetch `GET /api/v1/project-groups/me/meetings`.

---

## 5) Suggested rollout order

1. Build advisor project selector and advisor meetings list.
2. Add schedule form and wire POST.
3. Add advisor history tab using computed flags.
4. Add student meetings list/details.
5. Add websocket listener for `project-group-meeting` and notification refresh.

---

## 6) Step 2 - Update and Cancel Meetings

This step adds advisor controls to reschedule/update meeting details and cancel a meeting while keeping history.

### 6.1 Update/reschedule meeting

Call:
- `PATCH /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<selectedProjectId>`

Request body (all fields optional, partial update):
```json
{
  "title": "Weekly Progress Check (Updated)",
  "meetingAt": "2026-04-16T14:00:00.000Z",
  "durationMinutes": 90,
  "agenda": "Review milestones, blockers, and revised sprint tasks."
}
```

Validation notes:
- If provided, `meetingAt` must be a valid future ISO datetime.
- If provided, `durationMinutes` must be at least 15.
- Cancelled meetings cannot be updated.

### 6.2 Cancel meeting

Call:
- `DELETE /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<selectedProjectId>`

Request body (optional):
```json
{
  "reason": "Advisor unavailable due to departmental emergency."
}
```

Behavior:
- Meeting is not physically deleted from history.
- Backend marks meeting as cancelled and returns updated meeting payload with:
  - `isCancelled: true`
  - `cancelledAt`
  - `cancellationReason`

### 6.3 New notification event types

Frontend can observe these in notification stream/history:
- `PROJECT_GROUP_MEETING_UPDATED`
- `PROJECT_GROUP_MEETING_CANCELLED`

### 6.4 Realtime event payload updates

Socket event name remains:
- `project-group-meeting`

`type` can now be:
- `scheduled`
- `updated`
- `cancelled`

Recommended behavior:
- On `updated`, replace existing meeting by `meetingId`.
- On `cancelled`, mark item as cancelled in list/history UI.

---

## 7) Step 3 - Automated 24h and 1h Meeting Reminders

Backend now runs an automated scheduler that sends in-app reminders for upcoming meetings.

### 7.1 Reminder triggers

1. 24-hour reminder: sent once when meeting enters <= 24h window.
2. 1-hour reminder: sent once when meeting enters <= 1h window.

Reminder scheduler behavior:
- Uses idempotent notification keys per user.
- Persists sent markers on each meeting (`reminder24hSentAt`, `reminder1hSentAt`).
- Skips cancelled meetings.

### 7.2 New notification event types

Frontend can filter/recognize:
- `PROJECT_GROUP_MEETING_REMINDER_24H`
- `PROJECT_GROUP_MEETING_REMINDER_1H`

### 7.3 Recommended frontend behavior

1. In notifications panel, show reminder badge and meeting time.
2. On reminder click, navigate to meeting details view.
3. If user is already on meetings page, refetch meetings list/details.

### 7.4 Reschedule behavior

When advisor changes `meetingAt`, backend resets reminder tracking for that meeting.
This ensures reminders are re-issued for the new schedule time.

---

## 8) Step 4 - Optional Email Reminders, Scheduler Test Coverage, and Advisor Filters

Step 4 extends reminders with optional email delivery, adds automated scheduler test coverage, and introduces advisor-friendly meeting filters for dashboard views.

### 8.1 Optional email reminders (24h and 1h)

In addition to in-app notifications, backend can send reminder emails when template IDs are configured.

Optional email configuration keys:
- `BREVO_PROJECT_GROUP_MEETING_REMINDER_24H_TEMPLATE_ID`
- `BREVO_PROJECT_GROUP_MEETING_REMINDER_1H_TEMPLATE_ID`

Behavior:
- If template ID exists, reminder email is sent to each project-group member with an email address.
- If template ID is missing, backend still sends in-app reminders only.
- Email reminders follow the same idempotent reminder markers used by scheduler.

### 8.2 Advisor dashboard/list filters

Advisor meetings list endpoint supports new query filters:

- `filter`:
  - `ALL` (default)
  - `UPCOMING_REMINDERS`
  - `CANCELLED`
- `reminderWindowHours`:
  - Optional
  - Allowed values: `24` or `1`
  - Used only when `filter=UPCOMING_REMINDERS` (default window is 24 hours)

Recommended usage patterns:
1. Upcoming reminder panel: `filter=UPCOMING_REMINDERS&reminderWindowHours=24`
2. Urgent upcoming panel: `filter=UPCOMING_REMINDERS&reminderWindowHours=1`
3. Cancelled history panel: `filter=CANCELLED`

### 8.3 Backend quality coverage for reminders

Automated scheduler unit tests now verify:
1. 24-hour reminder window behavior.
2. 1-hour reminder window behavior.
3. Idempotency using reminder sent markers.
4. Worker-dyno skip behavior.
