# Frontend Coordinator ↔ Advisor Direct Chat Integration Guide

This guide covers the **coordinator-advisor direct chat** feature, including room discovery, REST history, attachment upload, REST message actions, and Socket.IO realtime messaging.

This is a **direct one-to-one chat** between exactly:
- one `COORDINATOR`
- one `ADVISOR`

Unlike project-group chat, this conversation is **department-scoped**, not project-scoped.

## Scope / Rules

- Direct chat is available only between a **Coordinator** and an **Advisor** in the **same department** and **same tenant**.
- A room is unique per coordinator/advisor pair.
- Either side can open the room.
- A user can access a room only if they are one of the two room participants.
- Attachments are uploaded files only: PDF, DOCX, PPTX, XLSX, ZIP, JPG, PNG.
- Max attachment size is **5MB**.
- Message edit/delete is **sender-only**.
- Reactions, pins, and read-up-to are currently **REST-driven** for this chat type.

## Base

- Base URL: `/api/v1`
- Socket namespace: `/chat`
- Auth: Bearer JWT for REST, JWT in Socket.IO handshake for realtime

## Step 0 — Advisor-safe coordinator discovery (REST)

For advisor direct-chat UI, discover coordinators from this endpoint instead of tenant-admin user directory APIs.

**Request**
- `GET /api/v1/coordinator-advisor-chat/advisors/me/coordinators?search=&limit=20&cursor=`

Query params
- `search` optional string
- `limit` optional integer, default `20`, max `100`
- `cursor` optional opaque cursor from previous page

**Response (data)**
```json
{
  "items": [
    {
      "userId": "...",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "email": "abebe.kebede@academia.et",
      "avatarUrl": null,
      "roleName": "COORDINATOR",
      "departmentId": "...",
      "departmentName": "Computer Science",
      "isDirectChatEligible": true,
      "existingRoomId": "..."
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": null,
    "hasNext": false,
    "total": 1
  }
}
```

Notes
- Endpoint is advisor-only and tenant/department scoped server-side.
- Returned `userId` values are safe to pass to room resolution endpoint.
- `existingRoomId` can be used to open an existing conversation immediately.
- If no eligible coordinator exists, expect `200` with `items: []`.

## Step 1 — Get or create the direct chat room (REST)

Use this when a coordinator chooses an advisor, or an advisor chooses a coordinator.

**Request**
- `GET /api/v1/coordinator-advisor-chat/room?counterpartUserId=<userId>`

**Response (data)**
```json
{
  "roomId": "...",
  "coordinatorUserId": "...",
  "advisorUserId": "...",
  "departmentId": "..."
}
```

Notes
- `counterpartUserId` must be the other participant's **user id**.
- The backend creates the room if it does not exist yet.
- If the users are not a valid coordinator/advisor pair in the same department, this returns an error.
- Use `roomId` for all later REST and Socket.IO actions.

## Step 2 — Connect to Socket.IO `/chat`

**Client connect**
- Namespace: `/chat`
- Auth: JWT access token in the handshake

Example:
```ts
import { io } from "socket.io-client";

const socket = io(`${API_BASE_URL}/chat`, {
  transports: ["websocket"],
  auth: { token: accessToken },
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("disconnected", reason);
});
```

## Step 3 — Join the direct chat room (Socket)

**Emit**: `chat:join-direct`

Payload
```json
{ "roomId": "..." }
```

Ack response
```json
{
  "ok": true,
  "data": {
    "roomId": "...",
    "coordinatorUserId": "...",
    "advisorUserId": "...",
    "onlineUserIds": ["..."]
  }
}
```

On errors
```json
{ "ok": false, "error": { "code": "JOIN_FAILED", "message": "..." } }
```

After joining, the server places the socket in:
- `chat_room_<roomId>`

Presence broadcasts
- The server broadcasts `presence:update` for the joined room.

Payload
```json
{ "roomId": "...", "onlineUserIds": ["userId1", "userId2"] }
```

Important note
- Broadcast event names are shared with other chat features.
- If your frontend can keep multiple chat types connected at once, always filter by `roomId` in the event payload.

## Step 4 — Load message history (REST)

**Request**
- `GET /api/v1/direct-chat-rooms/:roomId/messages?limit=30`

**Response (data)**
```json
{
  "items": [
    {
      "id": "...",
      "roomId": "...",
      "senderUserId": "...",
      "sender": {
        "id": "...",
        "firstName": "...",
        "lastName": "...",
        "avatarUrl": "..."
      },
      "replyToMessageId": "...",
      "replyTo": {
        "id": "...",
        "roomId": "...",
        "senderUserId": "...",
        "sender": {
          "id": "...",
          "firstName": "...",
          "lastName": "...",
          "avatarUrl": "..."
        },
        "text": "...",
        "attachment": null,
        "createdAt": "2026-04-28T10:00:00.000Z"
      },
      "text": "Hello",
      "attachment": {
        "url": "...",
        "publicId": "...",
        "resourceType": "raw",
        "name": "file.pdf",
        "mimeType": "application/pdf",
        "size": 12345
      },
      "createdAt": "2026-04-28T10:00:00.000Z",
      "editedAt": null,
      "isPinned": false,
      "reactions": {
        "items": [{ "emoji": "👍", "count": 1 }],
        "myReaction": "👍"
      }
    }
  ],
  "nextCursor": "...",
  "readStates": [
    {
      "userId": "...",
      "lastReadMessageId": "...",
      "readAt": "2026-04-28T10:00:00.000Z"
    }
  ]
}
```

Pagination
- Results are ordered **newest → oldest**.
- To fetch older messages:
  - `GET /api/v1/direct-chat-rooms/:roomId/messages?cursor=<nextCursor>&limit=30`

UI tip
- If your UI renders oldest at the top, reverse `items` client-side.

## Step 5 — Send a text message (Socket)

**Emit**: `message:send-direct`

Payload
```json
{
  "roomId": "...",
  "clientMessageId": "optional-client-generated-id",
  "text": "Hello",
  "replyToMessageId": "optional-message-id-in-same-room"
}
```

Ack response
```json
{
  "ok": true,
  "data": {
    "roomId": "...",
    "clientMessageId": "optional-client-generated-id",
    "message": {
      "id": "...",
      "roomId": "...",
      "senderUserId": "...",
      "sender": {
        "id": "...",
        "firstName": "...",
        "lastName": "...",
        "avatarUrl": "..."
      },
      "replyToMessageId": null,
      "replyTo": null,
      "text": "Hello",
      "attachment": null,
      "createdAt": "2026-04-28T10:00:00.000Z",
      "editedAt": null,
      "isPinned": false,
      "reactions": {
        "items": [],
        "myReaction": null
      }
    },
    "deliveredAt": "2026-04-28T10:00:00.000Z"
  }
}
```

Broadcast
- The server broadcasts `message:new`

Listen
```ts
socket.on("message:new", (payload) => {
  // payload = { roomId, clientMessageId, message, deliveredAt }
});
```

Notes
- `clientMessageId` helps reconcile optimistic messages.
- A message must contain either `text`, or an `attachment`, or both.

## Step 6 — Upload an attachment, then send it

### 6.1 Upload the file (REST)

**Request**
- `POST /api/v1/direct-chat-rooms/:roomId/attachments`
- `Content-Type: multipart/form-data`
- Field name: `file`

Allowed mimetypes
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/zip`
- `application/x-zip-compressed`
- `image/jpeg`
- `image/png`

**Response (data)**
```json
{
  "url": "...",
  "publicId": "...",
  "resourceType": "image",
  "name": "photo.png",
  "mimeType": "image/png",
  "size": 12345
}
```

### 6.2 Send the uploaded attachment

You can send it through Socket.IO.

**Emit**: `message:send-direct`

Payload
```json
{
  "roomId": "...",
  "clientMessageId": "optional-client-generated-id",
  "text": "optional caption",
  "attachment": {
    "url": "...",
    "publicId": "...",
    "resourceType": "image",
    "name": "photo.png",
    "mimeType": "image/png",
    "size": 12345
  }
}
```

## Step 7 — REST send fallback

If your frontend wants a non-socket fallback for sending, use:
- `POST /api/v1/direct-chat-rooms/:roomId/messages`

Body
```json
{
  "text": "Hello",
  "replyToMessageId": "optional-message-id",
  "attachment": {
    "url": "...",
    "publicId": "...",
    "resourceType": "raw",
    "name": "file.pdf",
    "mimeType": "application/pdf",
    "size": 12345
  }
}
```

Response
- Returns the canonical stored message object directly.

Recommended use
- Prefer Socket.IO for normal chat UX.
- Use REST send as a fallback when sockets are unavailable or temporarily disconnected.

## Step 8 — Typing and presence

### 8.1 Start typing

**Emit**: `typing:start-direct`

Payload
```json
{ "roomId": "..." }
```

### 8.2 Stop typing

**Emit**: `typing:stop-direct`

Payload
```json
{ "roomId": "..." }
```

### 8.3 Presence snapshot

**Emit**: `presence:get-direct`

Payload
```json
{ "roomId": "..." }
```

Ack response
```json
{
  "ok": true,
  "data": {
    "roomId": "...",
    "onlineUserIds": ["..."]
  }
}
```

### 8.4 Listen to shared broadcast events

Typing broadcast
```ts
socket.on("typing:update", (payload) => {
  // payload = { roomId, userId, isTyping, at }
});
```

Presence broadcast
```ts
socket.on("presence:update", (payload) => {
  // payload = { roomId, onlineUserIds }
});
```

## Step 9 — Edit and delete messages

### 9.1 Edit via Socket

**Emit**: `message:edit-direct`

Payload
```json
{
  "roomId": "...",
  "messageId": "...",
  "text": "Updated text"
}
```

Broadcast
- `message:edited`

Listen
```ts
socket.on("message:edited", (payload) => {
  // payload = { roomId, messageId, message }
});
```

### 9.2 Delete via Socket

**Emit**: `message:delete-direct`

Payload
```json
{
  "roomId": "...",
  "messageId": "..."
}
```

Broadcast
- `message:deleted`

Listen
```ts
socket.on("message:deleted", (payload) => {
  // payload = { roomId, messageId, deletedAt }
});
```

### 9.3 REST fallbacks

Use these if sockets are unavailable:
- `PATCH /api/v1/direct-chat-rooms/:roomId/messages/:messageId`
- `DELETE /api/v1/direct-chat-rooms/:roomId/messages/:messageId`

## Step 10 — Read receipts, reactions, and pins (REST)

These are currently documented as REST-first for direct chat.

### 10.1 Mark read up to

**Request**
- `POST /api/v1/direct-chat-rooms/:roomId/read-up-to`

Body
```json
{ "messageId": "..." }
```

Response
```json
{
  "readUpToMessageId": "...",
  "readAt": "2026-04-28T10:00:00.000Z"
}
```

### 10.2 Set reaction

**Request**
- `POST /api/v1/direct-chat-rooms/:roomId/messages/:messageId/reaction`

Body
```json
{ "emoji": "👍" }
```

Response
```json
{
  "roomId": "...",
  "messageId": "...",
  "userId": "...",
  "emoji": "👍",
  "reactedAt": "2026-04-28T10:00:00.000Z"
}
```

### 10.3 Remove reaction

**Request**
- `DELETE /api/v1/direct-chat-rooms/:roomId/messages/:messageId/reaction`

Response
```json
{
  "roomId": "...",
  "messageId": "...",
  "userId": "...",
  "removedAt": "2026-04-28T10:00:00.000Z"
}
```

### 10.4 List pins

**Request**
- `GET /api/v1/direct-chat-rooms/:roomId/pins`

Response
```json
{
  "roomId": "...",
  "items": [
    {
      "messageId": "...",
      "pinnedByUserId": "...",
      "pinnedBy": {
        "id": "...",
        "firstName": "...",
        "lastName": "...",
        "avatarUrl": "..."
      },
      "pinnedAt": "2026-04-28T10:00:00.000Z",
      "message": {
        "id": "...",
        "roomId": "...",
        "senderUserId": "...",
        "sender": {
          "id": "...",
          "firstName": "...",
          "lastName": "...",
          "avatarUrl": "..."
        },
        "replyToMessageId": null,
        "replyTo": null,
        "text": "Pinned message",
        "attachment": null,
        "createdAt": "2026-04-28T10:00:00.000Z",
        "editedAt": null,
        "isPinned": true,
        "reactions": {
          "items": [],
          "myReaction": null
        }
      }
    }
  ]
}
```

### 10.5 Add pin

**Request**
- `POST /api/v1/direct-chat-rooms/:roomId/pins`

Body
```json
{ "messageId": "..." }
```

Response
```json
{
  "roomId": "...",
  "messageId": "...",
  "pinnedByUserId": "...",
  "pinnedAt": "2026-04-28T10:00:00.000Z"
}
```

### 10.6 Remove pin

**Request**
- `DELETE /api/v1/direct-chat-rooms/:roomId/pins/:messageId`

Response
```json
{
  "roomId": "...",
  "messageId": "...",
  "unpinnedByUserId": "...",
  "unpinnedAt": "2026-04-28T10:00:00.000Z"
}
```

## Recommended frontend flow

For the best UX, use this sequence:

1. load the counterpart user id from your directory or selection UI
2. call `GET /coordinator-advisor-chat/room`
3. connect socket and emit `chat:join-direct`
4. load initial history via REST
5. send messages via Socket.IO
6. upload files via REST, then send the returned attachment metadata through Socket.IO
7. use REST for read-up-to, reactions, and pins
8. keep local state synchronized using `message:new`, `message:edited`, `message:deleted`, `typing:update`, and `presence:update`

## Current backend behavior notes

- Direct chat uses **direct-specific client emit names**:
  - `chat:join-direct`
  - `presence:get-direct`
  - `typing:start-direct`
  - `typing:stop-direct`
  - `message:send-direct`
  - `message:edit-direct`
  - `message:delete-direct`
- Direct chat uses **shared broadcast event names**:
  - `presence:update`
  - `typing:update`
  - `message:new`
  - `message:edited`
  - `message:deleted`
- This means the frontend should route incoming events by `roomId`.
