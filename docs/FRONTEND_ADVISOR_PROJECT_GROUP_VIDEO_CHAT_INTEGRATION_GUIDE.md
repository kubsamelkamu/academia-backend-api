# Frontend Advisor to Project Group Video Chat Integration Guide

This is the single frontend integration document for advisor ↔ project-group video chat.

Use this guide if your frontend needs to support an advisor joining the supervised project group's chat room and starting, joining, leaving, or ending a Jitsi-backed video call.

## 1) Scope

This flow supports:
- advisor access to the supervised approved project-group chat room
- advisor ↔ project-group realtime chat in the `/chat` namespace
- advisor ↔ project-group video call presence signaling
- Jitsi room synchronization through backend-provided `meetingRoomName`

This flow does not use backend media transport.
Audio/video media is handled by Jitsi in the browser.

## 2) Backend prerequisites

Video call presence works only when these are configured on backend:
- `CHAT_VIDEO_PRESENCE_ENABLED=true` or `1` or `yes`
- `REDIS_URL` is configured

## 3) Authorization model

An advisor can use this flow only if:
- they are authenticated as `ADVISOR`
- they supervise the selected project
- that project is linked to an `APPROVED` project group

For an active call, backend allows room access for:
- approved project-group members
- the assigned advisor for that project group

Force-ending a call is allowed only for:
- call starter
- assigned advisor
- project-group leader

## 4) Step 1: Get the supervised chat room

When the advisor opens a supervised project, call:

- `GET /api/v1/project-groups/advisors/me/chat-room?projectId=<projectId>`

Expected response:

```json
{
  "roomId": "room-id",
  "projectGroupId": "group-id"
}
```

Use:
- `roomId` for message history, realtime events, and call events
- `projectGroupId` for `chat:join` and call payload consistency

## 5) Step 2: Connect to Socket.IO

Connect to:
- namespace: `/chat`

Your socket auth must include the advisor JWT token.

## 6) Step 3: Join the chat room

Emit:

```json
event: "chat:join"
payload: {
  "projectGroupId": "group-id"
}
```

Important:
- the backend joins the socket to `chat_room_<roomId>` internally
- all call presence events are broadcast to `chat_room_<roomId>`

## 7) Step 4: Listen for realtime events

Minimum events to handle:
- `message:new`
- `message:edited`
- `message:deleted`
- `presence:update`
- `typing:update`
- `call:started`
- `call:participantChanged`
- `call:ended`

## 8) Step 5: Start a video call

Emit `call:start` with:

```json
{
  "roomId": "room-id",
  "projectGroupId": "group-id",
  "meetingRoomName": "academia-tenant-group123",
  "at": "2026-04-05T10:00:00.000Z"
}
```

Rules:
- `meetingRoomName` is required on `call:start`
- maximum length is `128`
- allowed characters are letters, numbers, `_`, `-`
- backend uses `roomId` as the source of truth for the real group mapping

Backend behavior:
- if no active session exists, backend creates the call and broadcasts `call:started`
- if a session already exists, backend reuses the active call and broadcasts `call:participantChanged`

Frontend rule:
- do not assume your locally generated room name won
- always switch to the backend-broadcast `meetingRoomName`

## 9) Step 6: Join an active video call

Emit `call:join` with:

```json
{
  "roomId": "room-id",
  "projectGroupId": "group-id",
  "meetingRoomName": "academia-tenant-group123",
  "at": "2026-04-05T10:01:00.000Z"
}
```

Notes:
- `meetingRoomName` is optional on `call:join`, but recommended
- if supplied, it must match the backend active session value
- backend responds by broadcasting `call:participantChanged`

## 10) Step 7: Leave a call

Emit `call:leave` with:

```json
{
  "roomId": "room-id",
  "projectGroupId": "group-id",
  "meetingRoomName": "academia-tenant-group123",
  "at": "2026-04-05T10:10:00.000Z"
}
```

Backend behavior:
- participant count decreases
- if count stays above `0`, backend emits `call:participantChanged`
- if count reaches `0`, backend ends the call and emits `call:ended`

## 11) Step 8: End a call for everyone

Emit `call:end` with:

```json
{
  "roomId": "room-id",
  "projectGroupId": "group-id",
  "meetingRoomName": "academia-tenant-group123",
  "at": "2026-04-05T10:15:00.000Z"
}
```

Backend behavior:
- active session is deleted
- participant presence is cleared
- backend emits `call:ended`

Permission note:
- an advisor can force-end because assigned advisor is an allowed role for this action

## 12) Event payloads to consume

### `call:started`

```json
{
  "roomId": "room-id",
  "meetingRoomName": "academia-tenant-group123",
  "startedByUserId": "user-id",
  "startedAt": "2026-04-05T10:00:00.000Z",
  "participantCount": 1
}
```

### `call:participantChanged`

```json
{
  "roomId": "room-id",
  "meetingRoomName": "academia-tenant-group123",
  "participantCount": 2
}
```

### `call:ended`

```json
{
  "roomId": "room-id",
  "meetingRoomName": "academia-tenant-group123",
  "endedByUserId": "user-id",
  "endedAt": "2026-04-05T10:20:00.000Z"
}
```

## 13) ACK format

Success:

```json
{
  "ok": true,
  "data": {
    "roomId": "room-id",
    "meetingRoomName": "academia-tenant-group123",
    "participantCount": 2
  }
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "..."
  }
}
```

## 14) Error codes the frontend should handle

- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `ROOM_NOT_FOUND`
- `INTERNAL_ERROR`

Common reasons:
- advisor is not authorized for the selected room/project group
- `meetingRoomName` is invalid
- provided `projectGroupId` does not match the room
- active call does not exist for join/leave
- force-end was attempted by a user without permission

## 15) Frontend rules that matter most

- always use backend `meetingRoomName` as the Jitsi room source of truth
- if `call:start` leads to `call:participantChanged`, join the existing active call instead of creating a new room locally
- treat backend `participantCount` as authoritative
- treat backend timestamps as authoritative
- handle disconnects gracefully because backend will auto-apply leave logic when the socket drops

## 16) Minimal frontend checklist

1. Fetch `roomId` and `projectGroupId` from the advisor chat-room endpoint.
2. Connect to `/chat` with advisor JWT.
3. Emit `chat:join` with `projectGroupId`.
4. Listen for `call:started`, `call:participantChanged`, and `call:ended`.
5. On `call:start`, send `roomId`, `projectGroupId`, and `meetingRoomName`.
6. On every call event, replace local call state with backend values.
7. Join Jitsi using backend `meetingRoomName`, not only local fallback values.
