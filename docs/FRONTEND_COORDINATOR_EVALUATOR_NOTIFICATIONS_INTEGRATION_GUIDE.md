# Frontend Coordinator Evaluator Notifications Integration Guide

This guide explains how the frontend should integrate the Coordinator -> Evaluator Notifications feature.

It covers:

1. recipient lookup
2. send notification form
3. summary cards
4. notification history list
5. notification history detail view

This guide assumes the backend uses a campaign + recipient history design and that the evaluator notification feature is already implemented in the backend.

## Goal

The coordinator should be able to:

1. send a notification to one evaluator
2. send a notification to multiple evaluators
3. send a notification to all eligible evaluators in the department
4. target a specific evaluation stage using CAPSTONE_I or CAPSTONE_II
5. choose IN_APP, EMAIL, or BOTH
6. choose a priority level
7. view history of sent notifications
8. inspect delivery results per recipient

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <token>`
- Required role: `Coordinator`

Global success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

## Main endpoints

Use these endpoints for this feature:

- `GET /api/v1/coordinator/evaluators/notifications/recipients`
- `POST /api/v1/coordinator/evaluators/notifications`
- `GET /api/v1/coordinator/evaluators/notifications/history/summary`
- `GET /api/v1/coordinator/evaluators/notifications/history`
- `GET /api/v1/coordinator/evaluators/notifications/history/:campaignId`

## 1) Load evaluator recipient data

Use:

- `GET /api/v1/coordinator/evaluators/notifications/recipients?stage=CAPSTONE_I&page=1&limit=20&search=`

Purpose:

- populate the evaluator selector in the send form
- preview the count for ALL mode
- support stage-aware recipient selection

### Query parameters

- `stage`: required enum `CAPSTONE_I`, `CAPSTONE_II`
- `page`: optional, defaults to `1`
- `limit`: optional, defaults to `20`
- `search`: optional search by evaluator name or email

### Recommended fields to use from recipients response

From each evaluator item, use:

1. `evaluatorUserId`
2. `fullName`
3. `email`
4. `avatarUrl`
5. `assignedProjectsCount`
6. `pendingEvaluationsCount`
7. `submittedEvaluationsCount`

### Important ID rule

- use `evaluatorUserId` when sending notifications
- do not attempt to send project evaluator record ids

### Example response

```json
{
  "success": true,
  "message": "Evaluator recipients retrieved successfully",
  "data": {
    "stage": "CAPSTONE_I",
    "items": [
      {
        "evaluatorUserId": "evaluator-user-id-1",
        "fullName": "Dr Jane Smith",
        "email": "jane@example.com",
        "avatarUrl": null,
        "assignedProjectsCount": 3,
        "pendingEvaluationsCount": 2,
        "submittedEvaluationsCount": 1
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "pages": 1
    },
    "summary": {
      "totalEligibleEvaluators": 12
    }
  },
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

## 2) Send notification

Use:

- `POST /api/v1/coordinator/evaluators/notifications`

Purpose:

- send a coordinator notification to selected evaluators and create a campaign history record

### Request body

```json
{
  "recipientMode": "MULTIPLE",
  "evaluatorUserIds": [
    "evaluator-user-id-1",
    "evaluator-user-id-2"
  ],
  "stage": "CAPSTONE_I",
  "priority": "HIGH",
  "deliveryMethod": "BOTH",
  "subject": "Capstone I Evaluation Reminder",
  "message": "Please complete your pending evaluations before Friday 5 PM."
}
```

### Supported fields

- `recipientMode`: required enum `SINGLE`, `MULTIPLE`, `ALL`
- `evaluatorUserIds`: required for `SINGLE` and `MULTIPLE`, ignored or optional for `ALL`
- `stage`: required enum `CAPSTONE_I`, `CAPSTONE_II`
- `priority`: required enum `INFO`, `HIGH`, `CRITICAL`
- `deliveryMethod`: required enum `IN_APP`, `EMAIL`, `BOTH`
- `subject`: required, max 255
- `message`: required, max 5000 recommended

### Example success response

```json
{
  "success": true,
  "message": "Notification dispatched successfully",
  "data": {
    "campaignId": "campaign-uuid",
    "stage": "CAPSTONE_I",
    "recipientMode": "MULTIPLE",
    "requestedRecipients": 2,
    "inAppDelivered": 2,
    "emailQueued": 2,
    "emailDelivered": 0,
    "emailFailed": 0,
    "totalReached": 2,
    "createdAt": "2026-04-21T12:00:00.000Z"
  },
  "timestamp": "2026-04-21T12:00:00.000Z"
}
```

### Form behavior rules

1. if `recipientMode` is `SINGLE`, allow only one evaluator selection
2. if `recipientMode` is `MULTIPLE`, allow multiple selection
3. if `recipientMode` is `ALL`, hide manual evaluator selection and show eligible count preview
4. always require `stage`
5. require `subject`
6. require `message`
7. require `priority`
8. require `deliveryMethod`

### Recommended send form fields

Use these UI inputs:

1. stage select
2. recipient mode segmented control or select
3. evaluator autocomplete selector
4. priority select
5. delivery method select
6. subject text input
7. message textarea
8. recipient count preview
9. submit button

### Recommended submit UX

On successful send:

1. show toast `Notification sent`
2. clear the form
3. refresh summary and history list
4. optionally navigate to history detail for the created campaign

## 3) Summary cards

Use:

- `GET /api/v1/coordinator/evaluators/notifications/history/summary`
- `GET /api/v1/coordinator/evaluators/notifications/history/summary?stage=CAPSTONE_I`

Purpose:

- populate summary cards above the history list
- optionally filter cards by stage

### Example response

```json
{
  "success": true,
  "message": "Evaluator notification history summary retrieved",
  "data": {
    "stage": "CAPSTONE_I",
    "totalSent": 4,
    "delivered": 4,
    "totalReached": 21,
    "inAppDelivered": 21,
    "emailQueued": 21,
    "emailAccepted": 15,
    "emailDelivered": 0,
    "emailFailed": 1
  },
  "timestamp": "2026-04-21T12:00:00.000Z"
}
```

### Recommended card mapping

Use these cards first:

1. `Total Sent`
2. `Delivered`
3. `Total Reached`

### Optional secondary cards

1. `In-App Delivered`
2. `Email Queued`
3. `Email Accepted`
4. `Email Delivered`
5. `Email Failed`

### Important metric note

If backend email delivery webhooks have not yet confirmed final delivery for all messages:

- prefer showing `Email Accepted` or `Email Queued` separately
- do not present email delivery as fully confirmed unless `emailDelivered` is populated from webhook updates

## 4) List notification history

Use:

- `GET /api/v1/coordinator/evaluators/notifications/history?page=1&limit=10`

Purpose:

- populate the coordinator evaluator notification history table or cards

### Query parameters

- `page`: optional, defaults to `1`
- `limit`: optional, defaults to `10`
- `stage`: optional filter by `CAPSTONE_I` or `CAPSTONE_II`
- `deliveryMethod`: optional filter by `IN_APP`, `EMAIL`, or `BOTH`
- `priority`: optional filter by `INFO`, `HIGH`, or `CRITICAL`
- `search`: optional filter by subject or message text

### Example response

```json
{
  "success": true,
  "message": "Evaluator notification history retrieved",
  "data": {
    "items": [
      {
        "id": "campaign-uuid",
        "stage": "CAPSTONE_I",
        "subject": "Capstone I Evaluation Reminder",
        "message": "Please complete your pending evaluations before Friday 5 PM.",
        "priority": "HIGH",
        "deliveryMethod": "BOTH",
        "recipientMode": "ALL",
        "requestedRecipientsCount": 12,
        "inAppDeliveredCount": 12,
        "inAppFailedCount": 0,
        "emailQueuedCount": 12,
        "emailAcceptedCount": 9,
        "emailDeliveredCount": 0,
        "emailFailedCount": 1,
        "totalReachedCount": 12,
        "createdAt": "2026-04-21T12:00:00.000Z",
        "createdBy": {
          "id": "coordinator-user-id",
          "firstName": "Metti",
          "lastName": "Coordinator",
          "avatarUrl": null
        }
      }
    ],
    "pagination": {
      "total": 4,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  },
  "timestamp": "2026-04-21T12:00:00.000Z"
}
```

### Recommended columns

1. `subject`
2. `stage`
3. `priority`
4. `deliveryMethod`
5. `recipientMode`
6. `requestedRecipientsCount`
7. `inAppDeliveredCount`
8. `emailAcceptedCount`
9. `emailDeliveredCount`
10. `emailFailedCount`
11. `createdAt`
12. `view details`

### Recommended filtering support

The backend supports:

1. `page`
2. `limit`
3. `stage`
4. `deliveryMethod`
5. `priority`
6. `search`

## 5) View notification history detail

Use:

- `GET /api/v1/coordinator/evaluators/notifications/history/:campaignId`

Purpose:

- show one notification campaign and per-recipient delivery results

### Example response

```json
{
  "success": true,
  "message": "Evaluator notification history detail retrieved",
  "data": {
    "id": "campaign-uuid",
    "tenantId": "tenant-id",
    "departmentId": "department-id",
    "createdByUserId": "coordinator-user-id",
    "stage": "CAPSTONE_I",
    "recipientMode": "ALL",
    "deliveryMethod": "BOTH",
    "priority": "HIGH",
    "subject": "Capstone I Evaluation Reminder",
    "message": "Please complete your pending evaluations before Friday 5 PM.",
    "requestedRecipientsCount": 12,
    "inAppDeliveredCount": 12,
    "inAppFailedCount": 0,
    "emailQueuedCount": 12,
    "emailAcceptedCount": 9,
    "emailDeliveredCount": 0,
    "emailFailedCount": 1,
    "totalReachedCount": 12,
    "createdAt": "2026-04-21T12:00:00.000Z",
    "updatedAt": "2026-04-21T12:01:00.000Z",
    "createdBy": {
      "id": "coordinator-user-id",
      "firstName": "Metti",
      "lastName": "Coordinator",
      "avatarUrl": null
    },
    "recipients": [
      {
        "evaluatorUserId": "evaluator-user-id-1",
        "fullName": "Dr Jane Smith",
        "email": "jane@example.com",
        "inAppStatus": "DELIVERED",
        "emailStatus": "ACCEPTED",
        "emailFailureReason": null,
        "readAt": null
      },
      {
        "evaluatorUserId": "evaluator-user-id-2",
        "fullName": "Dr Mike Paul",
        "email": "mike@example.com",
        "inAppStatus": "DELIVERED",
        "emailStatus": "FAILED",
        "emailFailureReason": "delivery_failed",
        "readAt": "2026-04-21T13:00:00.000Z"
      }
    ]
  },
  "timestamp": "2026-04-21T12:00:00.000Z"
}
```

### Recommended recipient columns

1. `fullName`
2. `email`
3. `inAppStatus`
4. `emailStatus`
5. `readAt`
6. `emailFailureReason`

### Recommended status badge mapping

- in-app status:
  - `NOT_REQUESTED`
  - `DELIVERED`
  - `FAILED`
- email status:
  - `NOT_REQUESTED`
  - `QUEUED`
  - `ACCEPTED`
  - `DELIVERED`
  - `FAILED`

## Recommended frontend page structure

Use this layout:

1. page header
2. send notification button
3. optional stage filter bar
4. summary cards
5. history table
6. history detail drawer or detail route

## Suggested frontend types

```ts
export type EvaluationStage = 'CAPSTONE_I' | 'CAPSTONE_II';

export type EvaluatorNotificationRecipientMode = 'SINGLE' | 'MULTIPLE' | 'ALL';

export type EvaluatorNotificationDeliveryMethod = 'IN_APP' | 'EMAIL' | 'BOTH';

export type NotificationPriority = 'INFO' | 'HIGH' | 'CRITICAL';

export type InAppStatus = 'NOT_REQUESTED' | 'DELIVERED' | 'FAILED';

export type EmailStatus = 'NOT_REQUESTED' | 'QUEUED' | 'ACCEPTED' | 'DELIVERED' | 'FAILED';

export interface EvaluatorRecipientOption {
  evaluatorUserId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  assignedProjectsCount: number;
  pendingEvaluationsCount: number;
  submittedEvaluationsCount: number;
}

export interface SendCoordinatorEvaluatorNotificationRequest {
  recipientMode: EvaluatorNotificationRecipientMode;
  evaluatorUserIds?: string[];
  stage: EvaluationStage;
  priority: NotificationPriority;
  deliveryMethod: EvaluatorNotificationDeliveryMethod;
  subject: string;
  message: string;
}

export interface CoordinatorEvaluatorNotificationRecipientItem {
  evaluatorUserId: string;
  fullName: string;
  email: string;
  inAppStatus: InAppStatus;
  emailStatus: EmailStatus;
  emailFailureReason: string | null;
  readAt: string | null;
}
```

## Recommended first implementation order

Build the frontend in this order:

1. recipient lookup by stage
2. summary cards
3. history list page
4. history detail view
5. send notification form
6. send action integration
7. post-send refresh flow
8. optional polling for status progression

## Practical integration summary

- Use the recipients endpoint instead of analytics endpoints for evaluator selection.
- Always include `stage` in send requests and recipient lookups.
- Use `evaluatorUserId` as the selected identifier.
- Treat `emailAccepted` and `emailDelivered` as different delivery states.
- Prefer showing campaign history immediately after send so the coordinator can verify recipient outcomes.