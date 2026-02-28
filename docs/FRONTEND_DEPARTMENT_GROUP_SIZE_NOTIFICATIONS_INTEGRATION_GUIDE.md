# Frontend Integration Guide: Department Group Size Notifications

This guide explains how to integrate the **in-app + real-time notifications** that are emitted when department group size settings change.

Event covered:
- `DEPARTMENT_GROUP_SIZE_UPDATED`

---

## 1) Prerequisites

- You already have an **Access Token (JWT)** from the login flow.
- Base API URL (local default): `http://localhost:3001`
- API prefix/version: `/api/v1`

---

## 2) REST Notifications API (in-app notifications list)

All Notifications REST responses are wrapped by the global API response interceptor:

### Success envelope

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### Error envelope

```json
{
  "success": false,
  "message": "...",
  "error": { "code": "..." },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/..."
}
```

### Auth header

All endpoints require:

```
Authorization: Bearer <accessToken>
```

### 2.1 Get notifications (paginated)

- **GET** `/api/v1/notifications`

Query params (optional):
- `status`: `READ | UNREAD`
- `limit`: number
- `offset`: number

Example:
- `GET /api/v1/notifications?status=UNREAD&limit=20&offset=0`

**200 OK** response (`data` shape):

```json
{
  "notifications": [
    {
      "id": "...",
      "eventType": "DEPARTMENT_GROUP_SIZE_UPDATED",
      "severity": "INFO",
      "title": "Group Size Updated (Computer Science)",
      "message": "Computer Science group size updated: min 3, max 5.",
      "metadata": {
        "departmentId": "d1",
        "departmentName": "Computer Science",
        "minGroupSize": 3,
        "maxGroupSize": 5,
        "actorUserId": "u1"
      },
      "status": "UNREAD",
      "readAt": null,
      "createdAt": "2026-02-28T10:30:00.000Z"
    }
  ],
  "total": 100,
  "unreadCount": 5,
  "limit": 20,
  "offset": 0
}
```

### 2.2 Get unread count

- **GET** `/api/v1/notifications/unread-count`

**200 OK** response (`data` shape):

```json
{ "count": 5 }
```

### 2.3 Mark one notification as read

- **PATCH** `/api/v1/notifications/:id/read`

**200 OK** response (`data` shape):

```json
{
  "success": true,
  "notification": {
    "id": "...",
    "status": "READ",
    "readAt": "2026-02-28T10:31:00.000Z"
  }
}
```

> Note: if the notification does not exist or does not belong to the user, `data.success` will be `false`.

### 2.4 Mark all as read

- **PATCH** `/api/v1/notifications/mark-all-read`

**200 OK** response (`data` shape):

```json
{
  "success": true,
  "markedCount": 5
}
```

---

## 3) Real-time Notifications (Socket.IO)

Your backend emits real-time notifications through Socket.IO, user-targeted (room: `user_<userId>`).

### 3.1 Connection details

- Namespace: `/notifications`
- Local URL: `http://localhost:3001/notifications`

### 3.2 Auth

Send the JWT during the Socket.IO handshake using either:

- Preferred:

```ts
auth: { token: accessToken }
```

- Alternative:

```ts
query: { token: accessToken }
```

### 3.3 Event

- Server → Client event: `notification`

Payload is **not wrapped** (it is not the HTTP interceptor envelope). You receive a `Notification-like` object.

Example payload:

```json
{
  "id": "2f1a0c6f-0f0c-4ae0-9c6d-0ab0f0f1c001",
  "eventType": "DEPARTMENT_GROUP_SIZE_UPDATED",
  "severity": "INFO",
  "title": "Group Size Updated (Computer Science)",
  "message": "Computer Science group size updated: min 3, max 5.",
  "metadata": {
    "departmentId": "d1",
    "departmentName": "Computer Science",
    "minGroupSize": 3,
    "maxGroupSize": 5,
    "actorUserId": "u1"
  },
  "status": "UNREAD",
  "createdAt": "2026-02-28T10:30:00.000Z"
}
```

---

## 4) Recommended frontend behavior

### 4.1 Listen and filter by event type

```ts
socket.on("notification", (payload) => {
  if (payload?.eventType === "DEPARTMENT_GROUP_SIZE_UPDATED") {
    // 1) show toast/snackbar
    // 2) update notifications state (prepend)
    // 3) optionally refresh department settings (GET group-size)
  }
});
```

### 4.2 Keep your UI consistent

A practical approach:

- Always **prepend** the incoming notification to your local list
- Increment unread badge
- If the user is currently viewing group-size settings, re-fetch:
  - `GET /api/v1/department/settings/group-size`

### 4.3 Token refresh / reconnect

If your access token expires:

- close the socket
- obtain a fresh token (your existing refresh flow)
- reconnect with the new token

---

## 5) Quick copy/paste examples

### 5.1 Socket.IO client (TypeScript)

```ts
import { io, Socket } from "socket.io-client";

type NotificationPayload = {
  id: string;
  eventType: string;
  severity: string;
  title: string;
  message: string;
  metadata?: any;
  status: "UNREAD" | "READ";
  createdAt: string;
};

export function connectNotificationSocket(apiBaseUrl: string, accessToken: string): Socket {
  const socket = io(`${apiBaseUrl}/notifications`, {
    transports: ["websocket"],
    auth: { token: accessToken },
  });

  socket.on("connect", () => {
    console.log("notifications socket connected", socket.id);
  });

  socket.on("notification", (payload: NotificationPayload) => {
    // handle notifications here
    console.log("notification", payload);
  });

  socket.on("connect_error", (err) => {
    console.error("notification socket error", err?.message ?? err);
  });

  return socket;
}
```

### 5.2 Fetch notifications list (Axios)

```ts
import axios from "axios";

export async function getUnreadNotifications(apiBaseUrl: string, token: string) {
  const res = await axios.get(`${apiBaseUrl}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: "UNREAD", limit: 20, offset: 0 },
  });

  // HTTP responses are wrapped by the API interceptor
  return res.data.data;
}
```

---

## 6) Troubleshooting

- If you receive no real-time events:
  - confirm you connect to `/notifications` (not `/admin`)
  - confirm your token is included in handshake `auth.token`
  - confirm CORS allowed origin matches your frontend URL

- If HTTP responses don’t match your parsing:
  - remember HTTP is wrapped: read from `res.data.data`
  - Socket events are NOT wrapped
