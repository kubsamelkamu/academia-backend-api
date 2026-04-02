# Frontend Advisor Project-Group Announcements Integration Guide

This guide explains how to integrate **Advisor → supervised project-group announcements** in the Advisor Dashboard.

Feature summary:
- Advisor selects a **supervised project** (backend resolves the linked **APPROVED** project group).
- Advisor can **create / list / view / update / delete** announcements for that project group.
- Announcement can include optional `deadlineAt` for **student countdown UI**.
- Students read announcements from the existing student endpoint and receive realtime socket updates.

---

## 1) REST API (Advisor)

Base path:
- `/api/v1/project-groups/advisors/me/announcements`

Auth:
- Bearer JWT
- Role: `ADVISOR`

Important rule:
- Advisor endpoints are scoped by `projectId` (the supervised project).
- Backend uses `projectId → proposal → projectGroup` and requires group status `APPROVED`.

---

## 2) Step-by-step Advisor Dashboard integration

### Step 1 — Fetch advisor projects (for the selector)

Call:
- `GET /api/v1/projects/advisors/me/projects`

Frontend:
- Render a selector from the returned projects.
- When the advisor chooses one project, store:
  - `selectedProjectId`

---

### Step 2 — List announcements for the selected project

Call:
- `GET /api/v1/project-groups/advisors/me/announcements?projectId=<selectedProjectId>&page=1&limit=20`

Query params:
- `projectId` (required, UUID)
- `page` (optional, default `1`)
- `limit` (optional, default `20`)

Response shape:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "string",
        "priority": "HIGH|MEDIUM|LOW",
        "message": "string",
        "attachmentType": "NONE|LINK|FILE",
        "attachmentUrl": "string|null",
        "deadlineAt": "ISO|null",
        "disableAfterDeadline": true,
        "isExpired": false,
        "isDisabled": false,
        "secondsRemaining": 12345,
        "createdAt": "ISO",
        "updatedAt": "ISO",
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

---

### Step 3 — Create announcement (advisor)

Call:
- `POST /api/v1/project-groups/advisors/me/announcements`

Request body:
```json
{
  "projectId": "<selectedProjectId>",
  "title": "Deadline reminder",
  "priority": "HIGH",
  "message": "Submit milestone before deadline.",
  "attachmentUrl": "https://example.com/file.pdf",
  "deadlineAt": "2026-04-05T10:00:00.000Z",
  "disableAfterDeadline": true
}
```

Field notes:
- Required:
  - `projectId`, `title`, `priority`, `message`
- Optional:
  - `attachmentUrl` (link attachment)
  - `deadlineAt` (ISO date string)
  - `disableAfterDeadline` (boolean)
- `priority` must be: `HIGH | MEDIUM | LOW`
- If `deadlineAt` is provided it must be **in the future**.

Response:
- Save returned `data.id` as `announcementId`.
- You may also store `data.projectGroupId` (informational).

UI recommendation:
- After successful `POST`, prepend the new announcement into local list state.

---

### Step 4 — Get one announcement (details view)

Call:
- `GET /api/v1/project-groups/advisors/me/announcements/:announcementId?projectId=<selectedProjectId>`

Example:
- `GET /api/v1/project-groups/advisors/me/announcements/4c21de97-71d8-4858-a38b-cfc065badb50?projectId=<selectedProjectId>`

---

### Step 5 — Update announcement

Call:
- `PATCH /api/v1/project-groups/advisors/me/announcements/:announcementId?projectId=<selectedProjectId>`

Update body examples:

1) Update message/title:
```json
{
  "title": "Deadline reminder (updated)",
  "message": "Submit milestone before deadline (updated)."
}
```

2) Set/update deadline:
```json
{
  "deadlineAt": "2026-04-06T10:00:00.000Z",
  "disableAfterDeadline": true
}
```

3) Set link attachment:
```json
{
  "attachmentUrl": "https://example.com/new-file.pdf"
}
```

4) Remove attachment:
```json
{
  "removeAttachment": true
}
```

Important:
- Choose only one attachment operation per request:
  - set `attachmentUrl`
  - OR `removeAttachment: true`

UI recommendation:
- Replace the updated item in local list state using the returned `data.id`.

---

### Step 6 — Delete announcement

Call:
- `DELETE /api/v1/project-groups/advisors/me/announcements/:announcementId?projectId=<selectedProjectId>`

UI recommendation:
- On success, remove the item from local list state.

---

## 3) Student integration (read + countdown)

Students read announcements from the existing endpoint:
- `GET /api/v1/project-groups/me/announcements?page=1&limit=20`

Countdown fields returned per item:
- `deadlineAt: string | null`
- `isExpired: boolean`
- `isDisabled: boolean`
- `secondsRemaining: number | null`

Frontend display recommendation:
- If `deadlineAt` is `null`: hide countdown.
- If `secondsRemaining > 0`: render countdown.
- If `secondsRemaining === 0` OR `isExpired === true`: show expired UI.

---

## 4) Realtime contract (students)

Socket namespace:
- `/notifications`

Event emitted by backend:
- `project-group-announcement`

Payload:
```json
{
  "type": "created | updated | deleted",
  "projectGroupId": "uuid",
  "announcementId": "uuid",
  "announcement": { "...": "announcement object for created/updated" },
  "occurredAt": "ISO timestamp"
}
```

Frontend behavior:
- `created`: prepend by `announcementId`
- `updated`: replace by `announcementId` and reset local countdown from server `secondsRemaining`
- `deleted`: remove by `announcementId`
- safest fallback: refetch `GET /api/v1/project-groups/me/announcements`

Important note about recipients:
- Realtime announcement events are currently emitted to **project group leader + members**.
- Advisors are not included in realtime recipients unless they are also a group member.
- Advisor dashboard should update its own UI from the REST responses (create/update/delete) or by periodic refetch.
