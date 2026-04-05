# Frontend Chat Video Call Presence — Backend Implementation Guide

This document describes the finalized backend behavior for chat video call presence.

## 1) Status

Implemented and ready behind feature flag.

Scope is presence signaling only:
- start/join/leave/end call state
- participant count synchronization
- disconnect cleanup
- authoritative `meetingRoomName` synchronization

Media transport is not handled by backend presence layer.

## 2) Feature flag and environment

Video presence handlers are enabled only when one of these is true:
- `CHAT_VIDEO_PRESENCE_ENABLED=true` (or `1`, `yes`)
- `chat.video.presence.enabled=true` (or `1`, `yes`)

Redis is required at runtime when feature is enabled:
- `REDIS_URL` must be configured

## 3) Socket namespace and room

- Namespace: `/chat`
- Broadcast room target: `chat_room_<roomId>`

All call presence events are emitted to `chat_room_<roomId>` only.

## 4) Client emits supported

### 4.1 `call:start`

Expected payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string",
  "meetingRoomName": "string",
  "at": "ISO-8601 (optional/informational)"
}
```

Behavior:
- validates auth and room call access
- validates `roomId` + `projectGroupId` mapping if provided
- validates `meetingRoomName`
- uses `roomId` as the server-side source of truth for `projectGroupId`
- creates/keeps active call state (idempotent)
- adds caller to participant set
- if no active session exists: emits `call:started`
- if a session already exists: emits `call:participantChanged`

Validation rules for `meetingRoomName`:
- required on `call:start`
- max length `128`
- allowed characters: letters, numbers, `_`, `-`

### 4.2 `call:join`

Expected payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string (optional but validated if provided)",
  "at": "ISO-8601 (optional/informational)"
}
```

Behavior:
- validates auth and room call access
- validates `roomId` + `projectGroupId` mapping if provided
- if `meetingRoomName` is provided, it must match the active backend session value
- joins active call participant set (idempotent)
- emits `call:participantChanged` with backend `meetingRoomName`

### 4.3 `call:leave`

Expected payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string (optional but validated if provided)",
  "at": "ISO-8601 (optional/informational)"
}
```

Behavior:
- validates auth and room call access
- validates `roomId` + `projectGroupId` mapping if provided
- if `meetingRoomName` is provided, it must match the active backend session value
- removes participant from active set
- if participant count > 0: emits `call:participantChanged` with backend `meetingRoomName`
- if participant count == 0: ends call and emits `call:ended`

### 4.4 `call:end`

Expected payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string (optional but validated if provided)",
  "at": "ISO-8601 (optional/informational)"
}
```

Behavior:
- validates auth and room call access
- validates `roomId` + `projectGroupId` mapping if provided
- if there is an active session, only these users can force-end the call:
  - call starter
  - assigned advisor for the project group
  - project-group leader
- force ends call state (idempotent delete semantics)
- emits `call:ended`

If no active session exists, the endpoint remains idempotent and just validates room access.

## 5) Server broadcasts

### 5.1 `call:started`

```json
{
  "roomId": "string",
  "meetingRoomName": "string",
  "startedByUserId": "string",
  "startedAt": "server ISO timestamp",
  "participantCount": 1
}
```

### 5.2 `call:participantChanged`

```json
{
  "roomId": "string",
  "meetingRoomName": "string",
  "participantCount": 2
}
```

### 5.3 `call:ended`

```json
{
  "roomId": "string",
  "meetingRoomName": "string",
  "endedByUserId": "string",
  "endedAt": "server ISO timestamp"
}
```

## 6) ACK response contract

Success:

```json
{
  "ok": true,
  "data": {
    "roomId": "...",
    "meetingRoomName": "...",
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

## 7) Error codes currently used

- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `ROOM_NOT_FOUND`
- `INTERNAL_ERROR`

Typical reasons:
- unauthenticated socket
- invalid/missing payload fields
- invalid `meetingRoomName`
- not approved member/advisor or room/group mismatch
- call not active for join/leave
- `meetingRoomName` mismatch with active session
- force-end attempted by unauthorized participant
- feature disabled or backend not configured

## 8) Important backend rules frontend should rely on

- Backend uses server time for `startedAt` and `endedAt`.
- Client `at` is informational only.
- Duplicate emits are handled idempotently for participant counting.
- On abrupt disconnect (tab close/network drop), backend auto-applies leave logic and emits updated call state.
- Backend-broadcast `meetingRoomName` is the authoritative Jitsi room name while a call is active.
- `call:start` can return or broadcast `call:participantChanged` instead of `call:started` when another user already started the room session.
- The backend supports both approved project-group members and the assigned advisor for that project group.

## 9) Redis key model (for transparency)

- `chat:call:<roomId>` (HASH metadata)
- `chat:call:<roomId>:participants` (SET)
- `chat:call:user:<userId>:rooms` (SET reverse index for disconnect cleanup)

## 10) Frontend integration checklist

- emit from `/chat` namespace
- ensure user has joined `chat_room_<roomId>` before relying on call events
- include `meetingRoomName` on `call:start`
- listen for:
  - `call:started`
  - `call:participantChanged`
  - `call:ended`
- handle ACK failures by `error.code`
- treat backend participant count as source of truth
- treat backend `meetingRoomName` as source of truth
- when `call:start` returns or triggers `call:participantChanged`, join the existing active Jitsi room instead of generating a new local one
