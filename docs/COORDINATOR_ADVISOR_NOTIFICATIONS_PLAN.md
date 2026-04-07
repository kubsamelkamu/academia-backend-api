# Coordinator Advisor Notifications Plan

This document defines the stepwise implementation plan for the **Coordinator -> Advisor Notifications** feature.

It covers:

1. feature scope
2. required history model
3. delivery metrics definitions
4. backend phases
5. frontend phases
6. recommended implementation order

## Goal

Allow a coordinator to send notifications to:

1. one advisor
2. multiple advisors
3. all advisors in the coordinator's department

The coordinator can choose:

1. priority level
2. subject line
3. message body
4. delivery method: `IN_APP`, `EMAIL`, or `BOTH`

The system must also keep **history** and support dashboard metrics such as:

1. total sent
2. delivered
3. total reached

## Important metric definitions

These metrics must be defined clearly before implementation.

### 1) Total Sent

Recommended meaning:

- number of notification campaigns created by the coordinator

Example:

- coordinator sends 3 separate notification actions
- `Total Sent = 3`

This is a **campaign count**, not recipient count.

### 2) Delivered

Recommended meaning:

- number of recipient deliveries confirmed by channel

For v1, use this rule:

- `IN_APP` is considered delivered when the notification row is created successfully
- `EMAIL` is considered delivered only when the email provider confirms delivery through webhook tracking

Without provider webhook tracking, email should **not** be labeled delivered.

If webhook tracking is not implemented yet, use this temporary label instead:

- `Email Accepted`

### 3) Total Reached

Recommended meaning:

- total number of advisor recipients targeted across all campaigns

Example:

- campaign 1 targets 5 advisors
- campaign 2 targets 10 advisors
- campaign 3 targets 4 advisors
- `Total Reached = 19`

This is a **recipient aggregate**.

## Recommended data model

The existing `Notification` table is not enough for coordinator history reporting.

It stores per-user in-app notifications, but it does not represent:

1. one logical send action by a coordinator
2. recipient selection mode
3. per-channel delivery results
4. campaign-level analytics

Add two new entities.

### 1) Notification campaign table

Suggested name:

- `CoordinatorAdvisorNotificationCampaign`

Suggested fields:

1. `id`
2. `tenantId`
3. `departmentId`
4. `createdByUserId`
5. `recipientMode` with values `SINGLE`, `MULTIPLE`, `ALL`
6. `deliveryMethod` with values `IN_APP`, `EMAIL`, `BOTH`
7. `priority`
8. `subject`
9. `message`
10. `requestedRecipientsCount`
11. `inAppDeliveredCount`
12. `emailQueuedCount`
13. `emailDeliveredCount`
14. `emailFailedCount`
15. `totalReachedCount`
16. `createdAt`
17. `updatedAt`

### 2) Notification campaign recipient table

Suggested name:

- `CoordinatorAdvisorNotificationRecipient`

Suggested fields:

1. `id`
2. `campaignId`
3. `advisorUserId`
4. `email`
5. `fullName`
6. `inAppStatus` with values like `PENDING`, `DELIVERED`, `FAILED`, `SKIPPED`
7. `emailStatus` with values like `NOT_REQUESTED`, `QUEUED`, `ACCEPTED`, `DELIVERED`, `FAILED`
8. `inAppNotificationId` nullable
9. `emailProviderMessageId` nullable
10. `emailFailureReason` nullable
11. `readAt` nullable for in-app reach follow-up
12. `createdAt`
13. `updatedAt`

## Backend scope by phase

## Phase 1 - Core send workflow

Build these capabilities first:

1. coordinator sends to one, many, or all advisors in department
2. save campaign history row
3. save one recipient row per advisor
4. create in-app notifications for selected recipients
5. queue email sends when delivery method includes email
6. return campaign summary response

### Phase 1 API endpoints

#### Send notification

- `POST /api/v1/coordinator/advisors/notifications`

Request body:

```json
{
  "recipientMode": "ALL",
  "advisorUserIds": [],
  "priority": "HIGH",
  "deliveryMethod": "BOTH",
  "subject": "Proposal Review Reminder",
  "message": "Please review pending proposals before Friday 5 PM."
}
```

Response:

```json
{
  "success": true,
  "message": "Notification dispatched successfully",
  "data": {
    "campaignId": "campaign-uuid",
    "recipientMode": "ALL",
    "requestedRecipients": 19,
    "inAppDelivered": 19,
    "emailQueued": 19,
    "emailDelivered": 0,
    "emailFailed": 0,
    "totalReached": 19,
    "createdAt": "2026-04-07T12:00:00.000Z"
  },
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

#### List history

- `GET /api/v1/coordinator/advisors/notifications/history?page=1&limit=10`

Response should contain campaign rows with summary counters.

#### Get one history item

- `GET /api/v1/coordinator/advisors/notifications/history/:campaignId`

Response should contain:

1. campaign summary
2. recipient rows
3. per-recipient channel statuses

#### Dashboard summary

- `GET /api/v1/coordinator/advisors/notifications/history/summary`

Response shape:

```json
{
  "success": true,
  "message": "Notification history summary retrieved",
  "data": {
    "totalSent": 3,
    "delivered": 3,
    "totalReached": 19,
    "emailAccepted": 19,
    "emailDelivered": 0,
    "inAppDelivered": 19
  },
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

### Phase 1 permission rules

1. role must be `Coordinator`
2. coordinator can target only advisors in the same department
3. coordinator cannot target users outside the tenant
4. duplicate advisor ids in request must be normalized
5. if recipient mode is `ALL`, backend resolves advisors from department directly

## Phase 2 - Email delivery tracking

This phase is required if the product truly needs a correct `Delivered` metric for email.

Build these capabilities:

1. store provider message ids per recipient
2. expose a secure email provider webhook endpoint
3. update recipient `emailStatus` from webhook events
4. recompute campaign counters from recipient rows

Without this phase:

1. in-app delivered can be accurate
2. email queued or accepted can be accurate
3. email delivered cannot be fully accurate

## Phase 3 - Read/reach analytics

If the product wants deeper analytics later, add:

1. `readCount`
2. `unreadCount`
3. `lastReadAt`
4. unique advisors reached by time range

This phase can use the existing notification `readAt` data for in-app notifications.

## Frontend scope by phase

## Phase 1 - Send form

Build a coordinator page with:

1. recipient mode selector
2. advisor picker for single and multiple selection
3. priority selector
4. delivery method selector
5. subject input
6. message textarea
7. recipient count preview
8. submit button

Validation rules:

1. `subject` required
2. `message` required
3. at least one advisor required unless mode is `ALL`
4. `deliveryMethod` required
5. `priority` required

## Phase 2 - History list

Build a history page with cards or a table.

Recommended columns:

1. subject
2. priority
3. delivery method
4. recipient mode
5. total reached
6. in-app delivered
7. email queued or delivered
8. sent by
9. sent at
10. view details action

## Phase 3 - History detail

Build a campaign detail drawer or page.

Show:

1. campaign content
2. recipient list
3. in-app status per recipient
4. email status per recipient
5. read status if available

## Recommended implementation order

Use this order to avoid rework.

1. finalize metric definitions
2. add Prisma schema for campaign and recipient history
3. generate migration
4. build coordinator send endpoint
5. build history summary endpoint
6. build history list endpoint
7. build history detail endpoint
8. write frontend integration guide
9. implement frontend send page
10. implement frontend history page
11. add email webhook tracking if true delivery analytics are required

## Recommended v1 dashboard cards

Use these cards first:

1. `Total Sent` = total campaign count
2. `In-App Delivered` = total created in-app deliveries
3. `Total Reached` = total recipient aggregate

If email webhook tracking is not implemented yet, do not label the email card `Delivered`.

Use:

1. `Email Queued`
2. or `Email Accepted`

Only use `Email Delivered` after webhook-based delivery tracking exists.

## Final recommendation

To match your requested analytics cleanly, implement this feature as a **campaign + recipient history system**, not just as direct notification sends.

That gives the frontend a solid foundation for:

1. send screen
2. history screen
3. summary cards
4. future read and delivery analytics