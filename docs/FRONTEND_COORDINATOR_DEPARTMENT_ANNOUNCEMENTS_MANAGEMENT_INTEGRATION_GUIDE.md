# Frontend Coordinator Department Announcements Management Integration Guide

This guide explains how to integrate the coordinator-side department announcements management UI.

It is focused only on coordinator management screens, not student-facing announcement consumption.

## Goal

The coordinator should be able to:

1. list department announcements
2. create a new announcement
3. open one announcement for editing
4. update an announcement
5. delete an announcement

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <token>`
- Required role: `Coordinator`

Global success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-07T10:00:00.000Z"
}
```

## Main endpoints

Base path:

- `/api/v1/departments/:departmentId/announcements`

Endpoints:

- `GET /api/v1/departments/:departmentId/announcements`
- `POST /api/v1/departments/:departmentId/announcements`
- `GET /api/v1/departments/:departmentId/announcements/:announcementId`
- `PATCH /api/v1/departments/:departmentId/announcements/:announcementId`
- `DELETE /api/v1/departments/:departmentId/announcements/:announcementId`

## 1) List announcements

Use:

- `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`

Purpose:

- populate the coordinator announcements table or list page

### Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | `number` | No | Defaults to `1` |
| `limit` | `number` | No | Defaults to `20`, max `100` |

### Example request

```http
GET /api/v1/departments/5d8cb816-0592-4a7c-9c01-8f62f7b9f9bc/announcements?page=1&limit=20
Authorization: Bearer <access-token>
```

### Example response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "announcement-id",
        "tenantId": "tenant-id",
        "departmentId": "department-id",
        "createdByUserId": "user-id",
        "title": "Form Project Group",
        "message": "Please form your project group before the deadline.",
        "actionType": "FORM_PROJECT_GROUP",
        "actionLabel": "Form Group",
        "actionUrl": "https://frontend.example.com/groups/form",
        "deadlineAt": "2026-04-12T10:00:00.000Z",
        "disableAfterDeadline": true,
        "expiredAt": null,
        "createdAt": "2026-04-07T09:00:00.000Z",
        "updatedAt": "2026-04-07T09:00:00.000Z",
        "createdBy": {
          "id": "user-id",
          "firstName": "Metti",
          "lastName": "Coordinator",
          "avatarUrl": null
        },
        "isExpired": false,
        "isDisabled": false,
        "secondsRemaining": 259200
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  },
  "timestamp": "2026-04-07T10:00:00.000Z"
}
```

### Recommended frontend list columns

Render these columns on the coordinator page:

1. title
2. message preview
3. action type
4. CTA label
5. deadline
6. countdown
7. status
8. created by
9. created at
10. actions

### Countdown and status rules

Use these fields returned by the backend:

- `deadlineAt`
- `secondsRemaining`
- `isExpired`
- `isDisabled`

Frontend rules:

- if `deadlineAt` is null, show `No deadline`
- if `isExpired` is true, show `Expired`
- if `isExpired` is false and `secondsRemaining` is not null, show countdown

## 2) Create announcement

Use:

- `POST /api/v1/departments/:departmentId/announcements`

Purpose:

- create a new department announcement from the coordinator UI

### Request body

```json
{
  "title": "Form Project Group",
  "message": "Please form your project group before Friday.",
  "actionType": "FORM_PROJECT_GROUP",
  "actionLabel": "Form Group",
  "actionUrl": "https://frontend.example.com/groups/form",
  "deadlineAt": "2026-04-12T10:00:00.000Z"
}
```

### Supported fields

- `title`: required, max 255
- `message`: required, max 5000
- `actionType`: required enum
- `actionLabel`: optional, max 120
- `actionUrl`: optional valid URL with protocol
- `deadlineAt`: optional ISO datetime string

### Allowed `actionType` values

- `FORM_PROJECT_GROUP`
- `SUBMIT_PROPOSAL`
- `UPLOAD_DOCUMENT`
- `REGISTER_PRESENTATION`
- `CUSTOM_ACTION`

### Create form rules

Recommended frontend behavior:

1. require `title`
2. require `message`
3. require `actionType`
4. if `actionLabel` is provided, keep it under 120 chars
5. if `actionUrl` is provided, validate full URL with protocol
6. if `deadlineAt` is provided, ensure it is in the future

### Coordinator create UI fields

Use these form inputs:

1. title text input
2. message textarea
3. action type select
4. action label text input
5. action URL text input
6. deadline datetime picker

### Recommended post-create behavior

After a successful create:

1. close modal or navigate back to list
2. show toast `Announcement created`
3. refetch announcements list

## 3) Get one announcement

Use:

- `GET /api/v1/departments/:departmentId/announcements/:announcementId`

Purpose:

- fetch one announcement for detail view or edit form preload

### Recommended use

Use this endpoint when:

1. the edit screen is opened directly by URL
2. you want fresh data before editing
3. you do not want to rely only on the list item cache

### Example response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "announcement-id",
    "tenantId": "tenant-id",
    "departmentId": "department-id",
    "createdByUserId": "user-id",
    "title": "Form Project Group",
    "message": "Please form your project group before Friday.",
    "actionType": "FORM_PROJECT_GROUP",
    "actionLabel": "Form Group",
    "actionUrl": "https://frontend.example.com/groups/form",
    "deadlineAt": "2026-04-12T10:00:00.000Z",
    "disableAfterDeadline": true,
    "expiredAt": null,
    "createdAt": "2026-04-07T09:00:00.000Z",
    "updatedAt": "2026-04-07T09:00:00.000Z",
    "createdBy": {
      "id": "user-id",
      "firstName": "Metti",
      "lastName": "Coordinator",
      "avatarUrl": null
    },
    "isExpired": false,
    "isDisabled": false,
    "secondsRemaining": 259200
  },
  "timestamp": "2026-04-07T10:00:00.000Z"
}
```

## 4) Update announcement

Use:

- `PATCH /api/v1/departments/:departmentId/announcements/:announcementId`

Purpose:

- update any part of an existing announcement

### Partial update behavior

You do not need to send all fields.
Send only the fields that changed.

### Example update body

```json
{
  "title": "Form Project Group Now",
  "message": "Please form your project group before Sunday.",
  "actionLabel": "Open Group Page",
  "actionUrl": "https://frontend.example.com/groups/form",
  "deadlineAt": "2026-04-14T10:00:00.000Z"
}
```

### Clear deadline body

If the coordinator removes the deadline in the UI, send:

```json
{
  "clearDeadline": true
}
```

### Update rules

Frontend should follow this logic:

1. if user edits deadline to a new value, send `deadlineAt`
2. if user removes deadline, send `clearDeadline: true`
3. if user did not touch deadline, omit both fields

### Recommended post-update behavior

After a successful update:

1. close modal or return to list
2. show toast `Announcement updated`
3. refetch announcements list

## 5) Delete announcement

Use:

- `DELETE /api/v1/departments/:departmentId/announcements/:announcementId`

Purpose:

- remove an announcement from the department

### Example response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "announcement-id",
    "deleted": true
  },
  "timestamp": "2026-04-07T10:00:00.000Z"
}
```

### Recommended delete flow

1. show confirm dialog
2. call delete endpoint on confirm
3. remove item from the UI or refetch list
4. show toast `Announcement deleted`

## 6) Suggested page structure

### Coordinator announcements page

Use one main page containing:

1. page header
2. `Create announcement` button
3. announcements table or cards
4. pagination controls

### Create announcement modal or page

Should support:

1. required title and message
2. action type selection
3. optional CTA
4. optional deadline

### Edit announcement modal or page

Should support:

1. load existing data
2. update any field
3. clear deadline separately

### Delete confirmation

Simple confirmation dialog is enough.

## 7) Suggested frontend TypeScript types

```ts
export interface DepartmentAnnouncement {
  id: string;
  tenantId: string;
  departmentId: string;
  createdByUserId: string;
  title: string;
  message: string;
  actionType:
    | 'FORM_PROJECT_GROUP'
    | 'SUBMIT_PROPOSAL'
    | 'UPLOAD_DOCUMENT'
    | 'REGISTER_PRESENTATION'
    | 'CUSTOM_ACTION';
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
}

export interface DepartmentAnnouncementsListResponse {
  items: DepartmentAnnouncement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

## 8) Suggested frontend fetch helpers

```ts
export async function fetchDepartmentAnnouncements(params: {
  token: string;
  departmentId: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));

  const response = await fetch(
    `/api/v1/departments/${params.departmentId}/announcements?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to load announcements');
  }

  return response.json();
}
```

```ts
export async function createDepartmentAnnouncement(params: {
  token: string;
  departmentId: string;
  body: {
    title: string;
    message: string;
    actionType:
      | 'FORM_PROJECT_GROUP'
      | 'SUBMIT_PROPOSAL'
      | 'UPLOAD_DOCUMENT'
      | 'REGISTER_PRESENTATION'
      | 'CUSTOM_ACTION';
    actionLabel?: string;
    actionUrl?: string;
    deadlineAt?: string;
  };
}) {
  const response = await fetch(`/api/v1/departments/${params.departmentId}/announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(params.body),
  });

  if (!response.ok) {
    throw new Error('Failed to create announcement');
  }

  return response.json();
}
```

## 9) Validation and error handling

### Client-side validation

Validate these before submit:

1. `title` is required
2. `message` is required
3. `actionType` is required
4. `actionUrl` must be a valid URL if present
5. `deadlineAt` must be in the future if present

### Common backend errors to map

- `403`: `You do not have access to this department.`
- `400`: `deadlineAt must be in the future`
- `400`: `actionUrl must be a valid URL`
- `404`: `Announcement not found`

### Practical frontend handling

1. show field errors for invalid deadline and invalid URL
2. show toast for create, update, delete success
3. if update or delete returns `404`, refetch list

## 10) Realtime note

For coordinator management UI, you do not need realtime to complete integration.

The safest coordinator flow is:

1. submit create, update, or delete
2. refetch list

That is enough for coordinator management screens.

## 11) Final implementation checklist

- [ ] coordinator can load announcement list
- [ ] coordinator can paginate announcements
- [ ] coordinator can create announcement
- [ ] coordinator can edit announcement
- [ ] coordinator can clear an existing deadline
- [ ] coordinator can delete announcement
- [ ] coordinator sees countdown and expired state
- [ ] frontend handles validation and backend errors correctly