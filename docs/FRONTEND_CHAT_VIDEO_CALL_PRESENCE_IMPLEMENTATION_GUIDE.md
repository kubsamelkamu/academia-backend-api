# Frontend Chat Video Call Presence — Backend Implementation Guide

This document describes what is now implemented in backend for group chat video call presence.

## 1) Status

Implemented and ready behind feature flag.

Scope is presence signaling only:
- start/join/leave/end call state
- participant count synchronization
- disconnect cleanup

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
  "at": "ISO-8601 (optional/informational)"
}
```

Behavior:
- validates auth and membership/access
- validates `roomId` + `projectGroupId` mapping
- creates/keeps active call state (idempotent)
- adds caller to participant set
- emits `call:started`

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
- validates auth and membership/access
- joins active call participant set (idempotent)
- emits `call:participantChanged`

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
- validates auth and membership/access
- removes participant from active set
- if participant count > 0: emits `call:participantChanged`
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
- validates auth and membership/access
- force ends call state (idempotent delete semantics)
- emits `call:ended`

## 5) Server broadcasts

### 5.1 `call:started`

```json
{
  "roomId": "string",
  "startedByUserId": "string",
  "startedAt": "server ISO timestamp",
  "participantCount": 1
}
```

### 5.2 `call:participantChanged`

```json
{
  "roomId": "string",
  "participantCount": 2
}
```

### 5.3 `call:ended`

```json
{
  "roomId": "string",
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
- not approved member or room/group mismatch
- call not active for join
- feature disabled or backend not configured

## 8) Important backend rules frontend should rely on

- Backend uses server time for `startedAt` and `endedAt`.
- Client `at` is informational only.
- Duplicate emits are handled idempotently for participant counting.
- On abrupt disconnect (tab close/network drop), backend auto-applies leave logic and emits updated call state.

## 9) Redis key model (for transparency)

- `chat:call:<roomId>` (HASH metadata)
- `chat:call:<roomId>:participants` (SET)
- `chat:call:user:<userId>:rooms` (SET reverse index for disconnect cleanup)

## 10) Frontend integration checklist

- emit from `/chat` namespace
- ensure user has joined `chat_room_<roomId>` before relying on call events
- listen for:
  - `call:started`
  - `call:participantChanged`
  - `call:ended`
- handle ACK failures by `error.code`
- treat backend participant count as source of truth
