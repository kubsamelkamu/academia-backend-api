# Real-time Project Group Announcements (WebSocket)

This document describes what is already implemented in the backend to support **real-time announcements** (so students can see new/updated/deleted announcements instantly without reloading).

## Overview

- Transport: **Socket.IO** (NestJS WebSocket Gateway)
- Namespace: `/notifications`
- Auth: JWT access token (sent during Socket.IO handshake)
- Delivery: targeted per-user rooms (`user_<userId>`) and broadcast to all members of a project group

## How socket authentication works

On connect, the gateway reads the token from either:

- `client.handshake.auth.token` (recommended)
- `client.handshake.query.token`

Then it verifies the JWT and joins the socket to a room:

- `user_<userId>`

## Announcement realtime event

When an announcement is created/updated/deleted, the backend emits a socket event:

- **Event name:** `project-group-announcement`
- **Namespace:** `/notifications`

### Payload

```json
{
  "type": "created | updated | deleted",
  "projectGroupId": "uuid",
  "announcementId": "uuid",
  "announcement": { "...": "announcement object (for created/updated)" },
  "occurredAt": "ISO-8601"
}
```

Notes:
- For `deleted`, `announcement` may be omitted; `announcementId` is still present.
- The event is sent to all group users **except the actor** (the user who performed the action).

## When events are emitted

The event is emitted as **best-effort** (it should not block the HTTP request):

- `created`: after `POST /api/v1/project-groups/me/announcements`
- `updated`: after `PATCH /api/v1/project-groups/me/announcements/:announcementId`
- `deleted`: after `DELETE /api/v1/project-groups/me/announcements/:announcementId`

## How recipients are determined

To broadcast to the correct users, the backend resolves all userIds in the project group:

- group leader `leaderUserId`
- all group member userIds from `members[]`

Then it removes the actor id and emits to the remaining recipients.

## Backend implementation locations

### Socket Gateway

- `src/modules/notification/notification.gateway.ts`
  - Existing: joins sockets to `user_<userId>` rooms
  - Added: `emitEventToUser()` and `emitEventToUsers()` helpers

### Group userId lookup

- `src/modules/project-group/project-group.repository.ts`
  - Added: `listProjectGroupUserIds(projectGroupId)`

### Announcement emits (create/update/delete)

- `src/modules/project-group/project-group.service.ts`
  - Added: `emitAnnouncementRealtime()`
  - Wired into:
    - `createAnnouncementForMyGroupLeader()`
    - `updateAnnouncementForMyGroupLeader()`
    - `deleteAnnouncementForMyGroupLeader()`

### Module wiring

- `src/modules/project-group/project-group.module.ts`
  - Added: `NotificationModule` import (so `ProjectGroupService` can inject `NotificationGateway`)

## Frontend expected behavior (minimal)

On receiving `project-group-announcement`, the frontend can:

- Refetch the announcements list (simplest):
  - `GET /api/v1/project-groups/me/announcements`

OR

- Patch local state:
  - `created`: prepend/add the announcement
  - `updated`: replace the announcement by id
  - `deleted`: remove the announcement by id
