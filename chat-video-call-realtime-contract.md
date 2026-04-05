# Chat Video Call Realtime Contract

This document defines the finalized Socket.IO contract for chat video calling.

For each call session, backend must issue a dedicated `meetingRoomName` (Jitsi room) and broadcast it to all participants.

## Scope

- Namespace: `/chat`
- Audience: approved project-group members and the assigned advisor for the group
- Room fan-out target: `chat_room_<roomId>`
- Source of truth for participant count: backend (Redis-backed presence)
- Source of truth for active Jitsi room: backend `meetingRoomName`

## Client emits

### `call:start`

Payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string",
  "meetingRoomName": "string",
  "at": "ISO-8601"
}
```

Behavior:
- Validate caller has access to `roomId`.
- Validate client `projectGroupId` against the room mapping if provided.
- Validate `meetingRoomName` format.
- Mark call active for `roomId`.
- If already active, keep active state (idempotent) and reuse the existing backend `meetingRoomName`.

Validation for `meetingRoomName`:
- required on `call:start`
- max length `128`
- allowed characters: `A-Z`, `a-z`, `0-9`, `_`, `-`

### `call:join`

Payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string",
  "meetingRoomName": "string (optional; if absent backend uses active session value)",
  "at": "ISO-8601"
}
```

Behavior:
- Register caller as active participant in `roomId`.
- If `meetingRoomName` is provided, it must match the active session value.
- Recompute participant count.

### `call:leave`

Payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string",
  "meetingRoomName": "string (optional; if absent backend uses active session value)",
  "at": "ISO-8601"
}
```

Behavior:
- Remove caller from active participant set.
- If `meetingRoomName` is provided, it must match the active session value.
- Recompute participant count.
- If count reaches 0, backend auto-ends the call.

### `call:end`

Payload:

```json
{
  "roomId": "string",
  "projectGroupId": "string",
  "meetingRoomName": "string (optional; if absent backend uses active session value)",
  "at": "ISO-8601"
}
```

Behavior:
- Force close active call state for `roomId`.
- Clear participant set.

Force-end permissions for an active session:
- call starter
- assigned advisor
- project-group leader

## Server broadcasts

### `call:started`

Payload:

```json
{
  "roomId": "string",
  "meetingRoomName": "string",
  "startedByUserId": "string",
  "startedAt": "ISO-8601",
  "participantCount": 1
}
```

### `call:participantChanged`

Payload:

```json
{
  "roomId": "string",
  "meetingRoomName": "string (optional)",
  "participantCount": 2
}
```

### `call:ended`

Payload:

```json
{
  "roomId": "string",
  "meetingRoomName": "string (optional)",
  "endedByUserId": "string",
  "endedAt": "ISO-8601"
}
```

## Validation rules

- Reject if unauthenticated.
- Reject if user cannot access the approved chat room.
- Reject if provided `projectGroupId` does not match the room's project group.
- Reject invalid `meetingRoomName` values.
- Reject mismatched `meetingRoomName` on active join/leave/end flows.
- Ignore stale `at` value from client for server state decisions.
- Use server time for `startedAt`/`endedAt`.

## Suggested implementation notes (backend)

- Track active calls in Redis:
  - Key: `chat:call:<roomId>` for call metadata
  - Set: `chat:call:<roomId>:participants`
- On socket disconnect, treat user as `call:leave` for any joined call room.
- Emit broadcasts to `chat_room_<roomId>`.
- Keep operations idempotent to handle duplicate emits.
- Use backend-broadcast `meetingRoomName` as the only authoritative Jitsi room name while a call is active.

## Frontend integration status

Implemented for chat video call consumers:
- emits: `call:start`, `call:join`, `call:leave`, `call:end`
- listens: `call:started`, `call:participantChanged`, `call:ended`
- backend may respond to `call:start` with `call:participantChanged` when reusing an existing session
- frontend must always join the backend-provided `meetingRoomName`
