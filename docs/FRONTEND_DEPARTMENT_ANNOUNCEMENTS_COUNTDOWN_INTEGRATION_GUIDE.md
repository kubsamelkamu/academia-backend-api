# Frontend Department Announcements Countdown Integration Guide

This guide explains how to integrate department announcements with optional deadlines and student countdown UI.

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
