# Frontend Project-Group Chat Integration Guide

This guide covers the **approved project-group chat** feature (text + optional uploaded attachment), including **REST** history + uploads and **Socket.IO** realtime messaging + read receipts.

## Scope / Rules

- Chat is available **only for students** in an **APPROVED** project group.
- A student can access a room only if they are the **group leader** or a **group member**.
- Attachments are **uploaded files only** (PDF/DOCX/PPTX/XLSX/ZIP/JPG/PNG, max **5MB**). URL links should be sent as plain `text`.
- Read receipts are **per-message** and updated using **“mark read up to message”**.

## Step 4.1 — Get (or create) my chat room (REST)

**Request**
- `GET /api/v1/project-groups/me/chat-room`

**Response (data)**
```json
{
  "roomId": "...",
  "projectGroupId": "..."
}
```

Notes
- If the user has no approved group, this returns an error.
- Use `roomId` for message history, attachment upload, and read-up-to calls.
- Use `projectGroupId` for joining realtime chat via Socket.IO (`chat:join`).

## Step 4.2 — Connect to Socket.IO `/chat` namespace

**Client connect**
- Namespace: `/chat`
- Auth: JWT access token must be provided in the Socket.IO handshake

Example (Socket.IO client)
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

## Step 4.3 — Join the project group chat (Socket)

**Emit**: `chat:join`

Payload
```json
{ "projectGroupId": "..." }
```

Ack response
```json
{ "ok": true, "data": { "roomId": "...", "projectGroupId": "...", "onlineUserIds": ["..."] } }
```

On errors
```json
{ "ok": false, "error": { "code": "JOIN_FAILED", "message": "..." } }
```

After joining, the server places the socket in a room named:
- `chat_room_<roomId>`

Presence updates
- The server broadcasts `presence:update` to `chat_room_<roomId>` whenever someone joins/leaves.

Payload
```json
{ "roomId": "...", "onlineUserIds": ["userId1", "userId2"] }
```

## Step 4.4 — Load initial message history (REST)

**Request**
- `GET /api/v1/chat-rooms/:roomId/messages?limit=30`

**Response (data)**
```json
{
  "items": [
    {
      "id": "...",
      "roomId": "...",
      "senderUserId": "...",
      "sender": { "id": "...", "firstName": "...", "lastName": "...", "avatarUrl": "..." },
      "replyToMessageId": "...",
      "replyTo": {
        "id": "...",
        "roomId": "...",
        "senderUserId": "...",
        "sender": { "id": "...", "firstName": "...", "lastName": "...", "avatarUrl": "..." },
        "text": "...",
        "attachment": null,
        "createdAt": "2026-03-13T00:00:00.000Z"
      },
      "text": "...",
      "attachment": {
        "url": "...",
        "publicId": "...",
        "resourceType": "raw",
        "name": "file.pdf",
        "mimeType": "application/pdf",
        "size": 12345
      },
      "createdAt": "2026-03-13T00:00:00.000Z",
      "editedAt": null,
      "isPinned": false,
      "reactions": {
        "items": [{ "emoji": "👍", "count": 2 }],
        "myReaction": "👍"
      }
    }
  ],
  "nextCursor": "...",
  "readStates": [
    { "userId": "...", "lastReadMessageId": "...", "readAt": "2026-03-13T00:00:00.000Z" }
  ]
}
```

Pagination
- Results are ordered **newest → oldest**.
- To fetch older messages:
  - `GET /api/v1/chat-rooms/:roomId/messages?cursor=<nextCursor>&limit=30`

UI tip
- If your UI renders oldest at the top, reverse `items` client-side.

## Step 4.5 — Send a text message (Socket)

**Emit**: `message:send`

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
- On success, `data.message` contains the canonical stored message.
- The server also broadcasts `message:new` to everyone in the room.

Listen
```ts
socket.on("message:new", (payload) => {
  // payload = { roomId, clientMessageId, message, deliveredAt }
});
```

`clientMessageId`
- Use this to reconcile optimistic UI messages with the server-confirmed message.

Delivery status
- `deliveredAt` is the server timestamp when the message was accepted and stored (currently equal to `message.createdAt`).

## Step 4.6 — Upload an attachment (REST), then send it (Socket)

### 4.6.a Upload

**Request**
- `POST /api/v1/chat-rooms/:roomId/attachments`
- `Content-Type: multipart/form-data`
- Field name: `file`

Constraints
- Max size: **5MB**
- Allowed mimetypes:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)
  - `application/zip` (ZIP)
  - `application/x-zip-compressed` (ZIP on some clients)
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

### 4.6.b Send message referencing the uploaded file

**Emit**: `message:send`

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

Notes
- A message must contain **either** `text` **or** an `attachment` (or both).
- URL links should be placed in `text` (not uploaded as an attachment).

## Step 4.7 — Read receipts (Socket-first; REST fallback)

### 4.7.a Mark read up to (Socket)

**Emit**: `message:markReadUpTo`

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

Broadcast event
- The server broadcasts: `message:readUpTo`

Payload
```json
{
  "roomId": "...",
  "userId": "...",
  "readUpToMessageId": "...",
  "readAt": "2026-03-13T00:00:00.000Z"
}
```

### 4.7.b REST fallback

If sockets are unavailable, call:
- `POST /api/v1/chat-rooms/:roomId/read-up-to`

Body
```json
{ "messageId": "..." }
```

## Step 4.8 — Edit and delete messages (sender only)

### 4.8.a Edit (Socket)

**Emit**: `message:edit`

Payload
```json
{ "roomId": "...", "messageId": "...", "text": "Updated text" }
```

Broadcast
- The server broadcasts `message:edited` to the room.

Payload
```json
{ "roomId": "...", "messageId": "...", "message": { "id": "...", "editedAt": "2026-03-13T00:00:00.000Z" } }
```

### 4.8.b Edit (REST fallback)

- `PATCH /api/v1/chat-rooms/:roomId/messages/:messageId`

Body
```json
{ "text": "Updated text" }
```

### 4.8.c Delete (Socket)

**Emit**: `message:delete`

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

Broadcast
- The server broadcasts `message:deleted` to the room.

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

### 4.8.d Delete (REST fallback)

- `DELETE /api/v1/chat-rooms/:roomId/messages/:messageId`

Notes
- Only the **sender** can edit/delete their message.
- Delete is a **hard delete**.

## Step 4.9 — Online/offline presence

- Subscribe to `presence:update` to show which members are currently online.
- You can fetch current state via `presence:get`.

**Emit**: `presence:get`

Payload
```json
{ "roomId": "..." }
```

Ack
```json
{ "ok": true, "data": { "roomId": "...", "onlineUserIds": ["..."] } }
```

## Step 4.10 — Typing status

Client emits
- `typing:start` when user begins typing
- `typing:stop` when user stops typing (or after a debounce timeout)

Payload
```json
{ "roomId": "..." }
```

Server broadcasts
- `typing:update` to the room

Payload
```json
{ "roomId": "...", "userId": "...", "isTyping": true, "at": "2026-03-13T00:00:00.000Z" }
```

## Step 4.11 — Delivery status (delivered-to-server)

When you emit `message:send`, the server returns `deliveredAt` in the ack, and broadcasts it in `message:new`.

Example ack (shape)
```json
{
  "ok": true,
  "data": {
    "roomId": "...",
    "clientMessageId": "...",
    "message": { "id": "...", "createdAt": "2026-03-13T00:00:00.000Z" },
    "deliveredAt": "2026-03-13T00:00:00.000Z"
  }
}
```

Notes
- This represents “delivered to server” (not necessarily read).
- Read state is handled separately via `message:markReadUpTo`.

## Step 4.12 — Reactions (1 per user per message)

Rules
- Any emoji string is accepted.
- Each user can have **max 1** reaction per message (setting a new emoji replaces the previous one).

### 4.12.a Set reaction (Socket)

**Emit**: `reaction:set`

Payload
```json
{ "roomId": "...", "messageId": "...", "emoji": "🔥" }
```

Broadcast
- The server broadcasts `reaction:updated` to the room.

Payload
```json
{ "roomId": "...", "messageId": "...", "userId": "...", "emoji": "🔥", "reactedAt": "2026-03-13T00:00:00.000Z" }
```

### 4.12.b Remove my reaction (Socket)

**Emit**: `reaction:remove`

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

Broadcast
- The server broadcasts `reaction:removed` to the room.

Payload
```json
{ "roomId": "...", "messageId": "...", "userId": "...", "removedAt": "2026-03-13T00:00:00.000Z" }
```

### 4.12.c REST fallback

Set reaction
- `POST /api/v1/chat-rooms/:roomId/messages/:messageId/reaction`

Body
```json
{ "emoji": "🔥" }
```

Remove reaction
- `DELETE /api/v1/chat-rooms/:roomId/messages/:messageId/reaction`

## Step 4.13 — Pinning messages (any room member; multiple pins allowed)

### 4.13.a Pin (Socket)

**Emit**: `pin:add`

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

Broadcast
- The server broadcasts `pin:added` to the room.

Payload
```json
{ "roomId": "...", "messageId": "...", "pinnedByUserId": "...", "pinnedAt": "2026-03-13T00:00:00.000Z" }
```

### 4.13.b Unpin (Socket)

**Emit**: `pin:remove`

Payload
```json
{ "roomId": "...", "messageId": "..." }
```

Broadcast
- The server broadcasts `pin:removed` to the room.

Payload
```json
{ "roomId": "...", "messageId": "...", "unpinnedByUserId": "...", "unpinnedAt": "2026-03-13T00:00:00.000Z" }
```

### 4.13.c REST fallback

List pins
- `GET /api/v1/chat-rooms/:roomId/pins`

Pin
- `POST /api/v1/chat-rooms/:roomId/pins`

Body
```json
{ "messageId": "..." }
```

Unpin
- `DELETE /api/v1/chat-rooms/:roomId/pins/:messageId`

## Step 4.14 — Minimal recommended frontend sequence

1) `GET /api/v1/project-groups/me/chat-room` → obtain `roomId` + `projectGroupId`
2) Connect socket to `/chat` with `auth.token`
3) Emit `chat:join` with `projectGroupId` (ack should return the same `roomId`)
4) Load history: `GET /api/v1/chat-rooms/:roomId/messages`
5) On new messages, listen to `message:new`
6) When the user reads to the latest message, emit `message:markReadUpTo`
7) For attachments: upload first (REST), then send `message:send` with `attachment`
8) For online/offline: listen to `presence:update` and/or call `presence:get`
9) For typing: emit `typing:start` / `typing:stop` and listen to `typing:update`
10) For reactions: emit `reaction:set` / `reaction:remove` (REST fallback supported)
11) For pins: emit `pin:add` / `pin:remove`, and fetch list via `GET /pins` when needed
