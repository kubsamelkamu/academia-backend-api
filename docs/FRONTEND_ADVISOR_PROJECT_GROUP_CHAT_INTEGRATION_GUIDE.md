# Frontend Advisor ↔ Project-Group Chat Integration Guide

This guide covers **advisor realtime chat** with a supervised **approved** project group.

It reuses the same chat room, REST endpoints, and Socket.IO events as the student chat.
For the general chat payloads/events, see `docs/FRONTEND_PROJECT_GROUP_CHAT_INTEGRATION_GUIDE.md`.

## Scope / Rules

- Chat is available to an **ADVISOR** only when they supervise a **Project** whose **Proposal** is linked to an **APPROVED** `ProjectGroup`.
- Advisors can access chat room REST endpoints only if they pass server-side membership checks (students in group OR assigned advisor).
- Message edit/delete is still **sender-only**.

## Step 1 — Get (or create) the supervised group chat room (REST)

Use this when the advisor selects a specific supervised project.

**Request**
- `GET /api/v1/project-groups/advisors/me/chat-room?projectId=<projectId>`

**Response (data)**
```json
{
  "roomId": "...",
  "projectGroupId": "..."
}
```

Notes
- If the project is not supervised by the advisor, or the linked group is not approved, this returns an error.
- Use `roomId` for message history, uploads, pins/reactions, and read-up-to.
- Use `projectGroupId` to join realtime chat via Socket.IO (`chat:join`).

## Step 2 — Connect & join via Socket.IO

- Namespace: `/chat`
- Join event: `chat:join` with `{ "projectGroupId": "..." }`

After joining, you can:
- Listen to `message:new`, `message:edited`, `message:deleted`
- Emit `message:send`, `message:edit`, `message:delete`
- Use `typing:update`, `presence:update`

(Exact event payloads and examples are the same as the student guide.)

## Step 3 — Load history & do REST fallbacks

These endpoints now work for both **STUDENT** and **ADVISOR** (when authorized):

- `GET /api/v1/chat-rooms/:roomId/messages`
- `POST /api/v1/chat-rooms/:roomId/attachments`
- `POST /api/v1/chat-rooms/:roomId/read-up-to`
- `PATCH /api/v1/chat-rooms/:roomId/messages/:messageId`
- `DELETE /api/v1/chat-rooms/:roomId/messages/:messageId`
- `POST /api/v1/chat-rooms/:roomId/messages/:messageId/reaction`
- `DELETE /api/v1/chat-rooms/:roomId/messages/:messageId/reaction`
- `GET /api/v1/chat-rooms/:roomId/pins`
- `POST /api/v1/chat-rooms/:roomId/pins`
- `DELETE /api/v1/chat-rooms/:roomId/pins/:messageId`

Attachment types
- Same as student chat: PDF, DOCX, PPTX, XLSX, ZIP, JPG, PNG (max 5MB).
