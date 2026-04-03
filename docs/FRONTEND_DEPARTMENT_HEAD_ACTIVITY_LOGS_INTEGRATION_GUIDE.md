# Frontend Department Head Activity Logs Integration Guide

This guide describes the **step 1** integration for the department head activity panel using the existing notifications API.

The goal of this first slice is simple:
- replace frontend mock activity cards with real backend data
- keep the UI contract stable while backend activity coverage grows over time
- avoid introducing a separate activity-log backend model too early

## Step 1 Scope

In this phase, the frontend uses the notifications endpoint as the source of truth for activity cards.

Supported backend source:
- `GET /api/v1/notifications`

Supported query filters for activity feeds:
- `status`
- `limit`
- `offset`
- `eventTypes` as a comma-separated list

Example:

```http
GET /api/v1/notifications?limit=10&eventTypes=PROPOSAL_SUBMITTED,PROPOSAL_APPROVED,PROPOSAL_REJECTED,PROPOSAL_FEEDBACK_ADDED,PROJECT_GROUP_FORMED,MILESTONE_COMPLETED
```

## Recommended Department Head Feed Request

For the initial activity widget, request the most recent activity-like notification types only.

Recommended request:

```http
GET /api/v1/notifications?limit=10&eventTypes=PROPOSAL_SUBMITTED,PROPOSAL_APPROVED,PROPOSAL_REJECTED,PROPOSAL_FEEDBACK_ADDED,PROJECT_GROUP_FORMED,MILESTONE_COMPLETED
```

Notes:
- This returns real notifications for the authenticated department head user.
- `total` and `unreadCount` in the response reflect the same filtered event types.
- Additional activity event types can be added later without changing the frontend card model.

## Current Response Shape

```json
{
  "notifications": [
    {
      "id": "...",
      "eventType": "PROPOSAL_SUBMITTED",
      "severity": "INFO",
      "title": "New Proposal Submitted",
      "message": "A new project proposal was submitted and is awaiting review.",
      "metadata": {
        "proposalId": "...",
        "submitterUserId": "...",
        "projectGroupId": "..."
      },
      "status": "UNREAD",
      "readAt": null,
      "createdAt": "2026-04-03T10:30:00.000Z"
    }
  ],
  "total": 1,
  "unreadCount": 1,
  "limit": 10,
  "offset": 0
}
```

## Frontend Normalization Contract

The frontend should map raw notifications into a stable activity-card shape.

Suggested client-side model:

```ts
type DepartmentActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  badge: 'pending' | 'completed' | 'info';
  occurredAt: string;
  href?: string;
  raw: unknown;
};
```

Suggested mapping:
- `id` <- `notification.id`
- `type` <- `notification.eventType`
- `title` <- `notification.title`
- `description` <- `notification.message`
- `occurredAt` <- `notification.createdAt`
- `raw` <- full notification object

Suggested badge mapping:
- `PROPOSAL_SUBMITTED` -> `pending`
- `PROPOSAL_APPROVED` -> `completed`
- `PROPOSAL_REJECTED` -> `completed`
- `PROPOSAL_FEEDBACK_ADDED` -> `completed`
- `PROJECT_GROUP_FORMED` -> `completed`
- `MILESTONE_COMPLETED` -> `completed`
- fallback -> `info`

## Navigation Hints

Use `metadata` to build click-through navigation when possible.

Examples:
- if `metadata.proposalId` exists, open the proposal details screen
- if `metadata.projectGroupId` exists, open the related project-group context

Because metadata differs by event type, the frontend should treat navigation as best-effort.

## UI Recommendations

To make the activity panel feel modern without increasing backend complexity:
- group items by `Today`, `Yesterday`, and `Earlier`
- show relative time such as `2 hours ago`
- render compact status pills for `pending` and `completed`
- keep the card headline bold and the secondary line quieter
- make the full card clickable when a destination can be resolved from metadata

## Planned Next Steps

The current step uses existing notification events only.

Planned backend additions for later slices:
1. a dedicated department-head activity endpoint that returns already-normalized activity cards
2. richer actor metadata for frontend avatar/name rendering
3. more department-head activity event types as workflows expand

This means the frontend can integrate now and adopt richer activity types incrementally later.