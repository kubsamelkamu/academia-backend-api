# Frontend Integration Guide: Profile + Notifications (All Roles)

This document describes the **role-agnostic** Profile and Notifications APIs and the Notifications WebSocket for the Academia backend.

## Base URL + Auth

- Base URL (local): `http://localhost:3001`
- API prefix + versioning: all routes below are under: `/<apiPrefix>/<version>/...`
  - Default in this project is: `/api/v1/...`
- Auth header (required for everything in this doc):
  - `Authorization: Bearer <ACCESS_TOKEN>`

## Profile API (all roles)

These endpoints operate on the **current authenticated user** (any role).

### 1) Get current profile

- **GET** `/api/v1/profile`
- **200 OK** response (example):

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": "https://...",
  "tenantId": "tenant-uuid",
  "roles": ["DepartmentHead"],
  "lastLoginAt": "2026-02-05T10:30:00.000Z"
}
```

### 2) Upload / overwrite avatar

- **POST** `/api/v1/profile/avatar`
- Content-Type: `multipart/form-data`
- Form field name: `avatar`
- Allowed mime types: `image/jpeg`, `image/png`, `image/webp`
- **200 OK** response (example):

```json
{
  "avatarUrl": "https://res.cloudinary.com/.../image/upload/.../user_avatar_<userId>.webp",
  "avatarPublicId": "academic-platform/users/avatars/user_avatar_<userId>"
}
```

Example curl:

```bash
curl -X POST \
  "http://localhost:3001/api/v1/profile/avatar" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "accept: */*" \
  -H "Content-Type: multipart/form-data" \
  -F "avatar=@/path/to/avatar.jpg;type=image/jpeg"
```

### 3) Delete avatar

- **DELETE** `/api/v1/profile/avatar`
- **204 No Content** response (empty body)

Example curl:

```bash
curl -X DELETE \
  "http://localhost:3001/api/v1/profile/avatar" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "accept: */*"
```

### 4) Update name

- **POST** `/api/v1/profile/update-name`
- Body: JSON `{ "firstName": string, "lastName": string }`
- **200 OK** response: same shape as “Get current profile” (with updated name)

Example curl:

```bash
curl -X POST \
  "http://localhost:3001/api/v1/profile/update-name" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 5) Change password

- **POST** `/api/v1/profile/change-password`
- Body: JSON `{ "oldPassword": string, "newPassword": string }`
- **200 OK** response:

```json
{ "message": "Password changed successfully" }
```

## Notifications API (all roles)

These endpoints return and mutate notifications for the **current authenticated user**.

### Notification object

```json
{
  "id": "notification-uuid",
  "eventType": "PROFILE_NAME_CHANGED",
  "severity": "INFO",
  "title": "Profile Name Updated",
  "message": "Your profile name has been successfully updated.",
  "metadata": { "oldName": "...", "newName": "..." },
  "status": "UNREAD",
  "readAt": null,
  "createdAt": "2026-02-24T10:30:00.000Z"
}
```

### 1) List notifications

- **GET** `/api/v1/notifications`
- Query params (optional):
  - `status`: `UNREAD` | `READ`
  - `limit`: number
  - `offset`: number

- **200 OK** response:

```json
{
  "notifications": [/* Notification[] */],
  "total": 123,
  "unreadCount": 5,
  "limit": 50,
  "offset": 0
}
```

### 2) Unread count

- **GET** `/api/v1/notifications/unread-count`
- **200 OK** response:

```json
{ "count": 5 }
```

### 3) Summary

- **GET** `/api/v1/notifications/summary`
- **200 OK** response:

```json
{
  "total": 123,
  "unread": 5,
  "bySeverity": {
    "INFO": 3,
    "HIGH": 2
  },
  "recent": [/* up to 5 unread notifications */]
}
```

### 4) Mark one as read

- **PATCH** `/api/v1/notifications/:id/read`
- **200 OK** response:

```json
{
  "success": true,
  "notification": { /* Notification */ }
}
```

If the notification is not found (or doesn’t belong to the user):

```json
{ "success": false }
```

### 5) Mark all as read

- **PATCH** `/api/v1/notifications/mark-all-read`
- **200 OK** response:

```json
{
  "success": true,
  "markedCount": 5
}
```

## Notifications WebSocket (Socket.IO) (all roles)

### Namespace

- Connect to namespace: `/notifications`
- Full URL (local): `http://localhost:3001/notifications`

### Auth

Send JWT token using either:

- Preferred: `auth: { token: "<ACCESS_TOKEN>" }`
- Alternative: `query: { token: "<ACCESS_TOKEN>" }`

### Events

- Server → client: `notification`
  - Payload: a Notification-like object (id/eventType/severity/title/message/metadata/status/createdAt)

### Example (socket.io-client)

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3001/notifications", {
  transports: ["websocket"],
  auth: {
    token: accessToken,
  },
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("notification", (payload) => {
  // Update unread badge + list in your UI
  console.log("notification", payload);
});

socket.on("disconnect", (reason) => {
  console.log("disconnected", reason);
});
```

## Breaking changes (important)

If your frontend still calls the old endpoints/namespaces, update them:

- Notifications REST:
  - Old: `/api/v1/admin/notifications/*` and `/api/v1/department-head/notifications/*`
  - New: `/api/v1/notifications/*`

- Notifications WebSocket:
  - Old namespace: `/admin`
  - New namespace: `/notifications`

- Profile REST:
  - Old: `/api/v1/admin/profile/*`
  - New: `/api/v1/profile/*`
