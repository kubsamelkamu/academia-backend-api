# Backend Handoff Checklist — Group Chat Video Call Presence

This checklist is derived from the realtime contract in `docs/chat-video-call-realtime-contract.md` and is designed for fast backend implementation.

## 1) Implementation scope

- Namespace: `/chat`
- Audience: approved project-group members only
- Fan-out room: `chat_room_<roomId>`
- Feature in scope: video call presence only (not media transport; Jitsi handles media)

---

## 2) Required server-side socket handlers

Implement these handlers in the `/chat` namespace:

### 2.1 `call:start`

- Validate auth/session.
- Validate payload:
  - `roomId` (string)
  - `projectGroupId` (string)
  - `at` (string; informational only)
- Validate access:
  - user belongs to approved `projectGroupId`
  - `roomId` maps to same project group
- Behavior:
  - initialize call state for room if missing
  - mark call as active
  - add caller to participant set
  - broadcast `call:started` with server timestamp

Broadcast payload:

```json
{
  "roomId": "<roomId>",
  "startedByUserId": "<userId>",
  "startedAt": "<server-iso>",
  "participantCount": 1
}
```

### 2.2 `call:join`

- Perform same auth + access validation.
- Add user to participant set (idempotent add).
- Recompute participant count.
- Broadcast `call:participantChanged`.

Broadcast payload:

```json
{
  "roomId": "<roomId>",
  "participantCount": 2
}
```

### 2.3 `call:leave`

- Perform same auth + access validation.
- Remove user from participant set.
- Recompute participant count.
- If count > 0:
  - broadcast `call:participantChanged`.
- If count == 0:
  - end call state and broadcast `call:ended`.

`call:ended` payload:

```json
{
  "roomId": "<roomId>",
  "endedByUserId": "<userId>",
  "endedAt": "<server-iso>"
}
```

### 2.4 `call:end`

- Perform same auth + access validation.
- Force end active call for room (clear participant set + active state).
- Broadcast `call:ended` (even if already ended, keep idempotent semantics).

---

## 3) Disconnect behavior (required)

On socket disconnect:

- For each active call room associated with that user:
  - execute same logic as `call:leave`
- This prevents stale participant counts when users close tab/network drops.

---

## 4) Redis schema (exact key plan)

Use Redis as source of truth for presence.

### 4.1 Keys

- Call metadata key:
  - `chat:call:<roomId>` (HASH)
- Participant set key:
  - `chat:call:<roomId>:participants` (SET)
- Optional user-to-room reverse index (for disconnect cleanup):
  - `chat:call:user:<userId>:rooms` (SET)

### 4.2 Metadata hash fields

In `chat:call:<roomId>`:

- `projectGroupId`
- `startedByUserId`
- `startedAt` (server ISO)
- `active` (`1` / `0`)

### 4.3 TTL strategy

- Set TTL (e.g., 24h) on both metadata + participants keys.
- Refresh TTL on `call:start`, `call:join`, `call:leave`.
- On `call:end`, delete both keys immediately.

### 4.4 Atomicity

Use a Lua script or Redis MULTI/EXEC for operations that mutate set + metadata + count together to avoid race conditions.

---

## 5) Event emission rules

Always emit to:

- `chat_room_<roomId>`

Do not emit globally.

Event names and payloads must match exactly:

- `call:started`
- `call:participantChanged`
- `call:ended`

---

## 6) Validation checklist (backend)

For each `call:*` emit from client:

- [ ] user authenticated
- [ ] payload shape valid
- [ ] user member of approved project group
- [ ] `roomId` belongs to project group
- [ ] ignore client `at` for authority (use server time)
- [ ] operation idempotent under duplicate emits

---

## 7) Failure and ack behavior

Recommended ACK format:

```json
{ "ok": true, "data": { "roomId": "...", "participantCount": 2 } }
```

or

```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

Suggested error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `ROOM_NOT_FOUND`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

---

## 8) Minimal test cases (must pass)

### 8.1 Unit tests

1. `call:start` creates active state and participant set with caller.
2. duplicate `call:start` by same user does not double-count participants.
3. `call:join` for existing participant remains idempotent.
4. `call:leave` decrements count correctly.
5. `call:leave` from last participant emits ended state.
6. `call:end` clears keys and emits `call:ended`.
7. unauthorized or cross-group user is rejected.

### 8.2 Integration tests (Socket + Redis)

1. User A starts call -> all room users receive `call:started` count=1.
2. User B joins -> all room users receive `call:participantChanged` count=2.
3. User B disconnects abruptly -> count updates to 1.
4. User A leaves -> `call:ended` broadcast and keys removed.
5. Duplicate network retries (`call:join` twice) keep stable count.

### 8.3 E2E scenarios (frontend + backend)

1. Two browsers, same group:
   - A starts call, B sees "Join call" banner.
2. B joins:
   - both see updated participant count.
3. B closes tab:
   - A sees participant count decrement.
4. A leaves/end:
   - both see call ended state.

---

## 9) Observability checklist

- [ ] Structured logs for all `call:*` events with `roomId`, `userId`, `projectGroupId`, `participantCount`.
- [ ] Metrics:
  - active calls
  - call starts/hour
  - average call duration
  - participant count distribution
- [ ] Error rate metric for rejected events.

---

## 10) Rollout plan

1. Deploy handlers behind feature flag `chat.video.presence.enabled`.
2. Enable in staging for one tenant.
3. Run integration + E2E checklist.
4. Gradually enable in production by tenant.
5. Remove flag after stable period.

---

## 11) Frontend compatibility note

Current frontend emits/listens these events already in:

- `src/components/dashboard/student/messages-page.tsx`

Shared payload types are in:

- `src/types/chat.ts`

Contract reference:

- `chat-video-call-realtime-contract.md`
