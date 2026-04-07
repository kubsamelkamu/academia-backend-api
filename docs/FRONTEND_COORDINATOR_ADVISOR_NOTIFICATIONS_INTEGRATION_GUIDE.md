# Frontend Coordinator Advisor Notifications Integration Guide

This guide explains how the frontend should integrate the **Coordinator -> Advisor Notifications** feature.

It covers:

1. send notification form
2. notification history list
3. notification history detail view
4. summary cards

This guide assumes the backend will use a **campaign + recipient history** design.

## Goal

The coordinator should be able to:

1. send a notification to one advisor
2. send a notification to multiple advisors
3. send a notification to all advisors in the department
4. choose `IN_APP`, `EMAIL`, or `BOTH`
5. choose a priority level
6. view history of sent notifications
7. inspect delivery results per recipient

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
  "timestamp": "2026-04-07T10:00:00.000Z"
}
```

## Main endpoints

Use these endpoints for this feature:

- `GET /api/v1/analytics/advisors/overview`
- `POST /api/v1/coordinator/advisors/notifications`
- `GET /api/v1/coordinator/advisors/notifications/history/summary`
- `GET /api/v1/coordinator/advisors/notifications/history`
- `GET /api/v1/coordinator/advisors/notifications/history/:campaignId`

## 1) Load advisor selection data

Use:

- `GET /api/v1/analytics/advisors/overview?page=1&limit=100&search=`

Purpose:

- populate the advisor selector in the send form

### Recommended fields to use from advisor overview

From each advisor item, use:

1. `advisorId`
2. `fullName`
3. `email`
4. `avatarUrl`
5. `status`
6. `currentLoad`
7. `availableCapacity`

### Important ID rule

- use `advisorId` when sending notifications
- do not use `advisorProfileId` for notification requests

## 2) Send notification

Use:

- `POST /api/v1/coordinator/advisors/notifications`

Purpose:

- send a coordinator notification to selected advisors and create a history record

### Request body

```json
{
  "recipientMode": "MULTIPLE",
  "advisorUserIds": [
    "advisor-user-id-1",
    "advisor-user-id-2"
  ],
  "priority": "HIGH",
  "deliveryMethod": "BOTH",
  "subject": "Proposal Review Reminder",
  "message": "Please review pending proposals before Friday 5 PM."
}
```

### Supported fields

- `recipientMode`: required enum `SINGLE`, `MULTIPLE`, `ALL`
- `advisorUserIds`: required for `SINGLE` and `MULTIPLE`, ignored or optional for `ALL`
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
    "recipientMode": "MULTIPLE",
    "requestedRecipients": 2,
    "inAppDelivered": 2,
    "emailQueued": 2,
    "emailDelivered": 0,
    "emailFailed": 0,
    "totalReached": 2,
    "createdAt": "2026-04-07T12:00:00.000Z"
  },
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

### Form behavior rules

1. if `recipientMode` is `SINGLE`, allow only one advisor selection
2. if `recipientMode` is `MULTIPLE`, allow multiple selection
3. if `recipientMode` is `ALL`, hide manual advisor selection and show advisor count preview
4. require `subject`
5. require `message`
6. require `priority`
7. require `deliveryMethod`

### Recommended send form fields

Use these UI inputs:

1. recipient mode segmented control or select
2. advisor autocomplete selector
3. priority select
4. delivery method select
5. subject text input
6. message textarea
7. recipient count preview
8. submit button

### Recommended submit UX

On successful send:

1. show toast `Notification sent`
2. clear the form
3. navigate to history detail or history list
4. optionally show campaign summary returned by backend

## 3) Summary cards

Use:

- `GET /api/v1/coordinator/advisors/notifications/history/summary`

Purpose:

- populate summary cards above the history list

### Example response

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

### Recommended card mapping

Use these cards first:

1. `Total Sent`
2. `Delivered`
3. `Total Reached`

### Important metric note

If backend email delivery webhooks are not implemented yet:

- prefer showing `In-App Delivered` or `Email Accepted`
- do not present email delivery as fully confirmed unless backend explicitly provides confirmed email delivery tracking

## 4) List notification history

Use:

- `GET /api/v1/coordinator/advisors/notifications/history?page=1&limit=10`

Purpose:

- populate the coordinator notification history table or cards

### Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | `number` | No | Defaults to `1` |
| `limit` | `number` | No | Defaults to `10` |
| `deliveryMethod` | `string` | No | Filter by `IN_APP`, `EMAIL`, or `BOTH` |
| `priority` | `string` | No | Filter by `INFO`, `HIGH`, `CRITICAL` |
| `search` | `string` | No | Filter by subject or message text |

### Example response

```json
{
  "success": true,
  "message": "Notification history retrieved",
  "data": {
    "items": [
      {
        "id": "campaign-uuid",
        "subject": "Proposal Review Reminder",
        "message": "Please review pending proposals before Friday 5 PM.",
        "priority": "HIGH",
        "deliveryMethod": "BOTH",
        "recipientMode": "ALL",
        "requestedRecipientsCount": 19,
        "inAppDeliveredCount": 19,
        "emailQueuedCount": 19,
        "emailDeliveredCount": 0,
        "emailFailedCount": 0,
        "totalReachedCount": 19,
        "createdAt": "2026-04-07T12:00:00.000Z",
        "createdBy": {
          "id": "coordinator-user-id",
          "firstName": "Metti",
          "lastName": "Coordinator",
          "avatarUrl": null
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  },
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

### Recommended history list columns

1. subject
2. priority
3. delivery method
4. recipient mode
5. total reached
6. in-app delivered
7. email queued or delivered
8. sent at
9. actions

### Recommended row actions

1. view details
2. duplicate as new send draft in future if the product needs it

## 5) Get one history item

Use:

- `GET /api/v1/coordinator/advisors/notifications/history/:campaignId`

Purpose:

- preload the detail drawer or page for one notification campaign

### Example response

```json
{
  "success": true,
  "message": "Notification history detail retrieved",
  "data": {
    "id": "campaign-uuid",
    "subject": "Proposal Review Reminder",
    "message": "Please review pending proposals before Friday 5 PM.",
    "priority": "HIGH",
    "deliveryMethod": "BOTH",
    "recipientMode": "ALL",
    "requestedRecipientsCount": 19,
    "inAppDeliveredCount": 19,
    "emailQueuedCount": 19,
    "emailDeliveredCount": 0,
    "emailFailedCount": 0,
    "totalReachedCount": 19,
    "createdAt": "2026-04-07T12:00:00.000Z",
    "recipients": [
      {
        "advisorUserId": "advisor-user-id-1",
        "fullName": "Abebe Advisor",
        "email": "abebe@example.com",
        "inAppStatus": "DELIVERED",
        "emailStatus": "QUEUED",
        "readAt": null
      }
    ]
  },
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

### Recommended detail sections

1. subject and message
2. metadata summary
3. campaign counters
4. recipient delivery table

### Recommended recipient detail columns

1. advisor name
2. email
3. in-app status
4. email status
5. read status

## 6) Suggested page structure

### Coordinator notifications page

Recommended layout:

1. page header
2. summary cards
3. `Send notification` button
4. history list or table

### Send notification modal or page

Recommended layout:

1. recipient mode section
2. advisor selection section
3. delivery configuration section
4. content section
5. preview summary section
6. submit action row

### History detail drawer or page

Recommended layout:

1. campaign metadata header
2. content preview
3. counters row
4. recipient results table

## 7) Frontend types

Suggested frontend types:

```ts
export type CoordinatorAdvisorNotificationRecipientMode =
  | 'SINGLE'
  | 'MULTIPLE'
  | 'ALL';

export type CoordinatorAdvisorNotificationDeliveryMethod =
  | 'IN_APP'
  | 'EMAIL'
  | 'BOTH';

export type CoordinatorAdvisorNotificationPriority =
  | 'INFO'
  | 'HIGH'
  | 'CRITICAL';

export interface CoordinatorAdvisorNotificationCreateInput {
  recipientMode: CoordinatorAdvisorNotificationRecipientMode;
  advisorUserIds?: string[];
  priority: CoordinatorAdvisorNotificationPriority;
  deliveryMethod: CoordinatorAdvisorNotificationDeliveryMethod;
  subject: string;
  message: string;
}

export interface CoordinatorAdvisorNotificationCampaignSummary {
  id: string;
  subject: string;
  message: string;
  priority: CoordinatorAdvisorNotificationPriority;
  deliveryMethod: CoordinatorAdvisorNotificationDeliveryMethod;
  recipientMode: CoordinatorAdvisorNotificationRecipientMode;
  requestedRecipientsCount: number;
  inAppDeliveredCount: number;
  emailQueuedCount: number;
  emailDeliveredCount: number;
  emailFailedCount: number;
  totalReachedCount: number;
  createdAt: string;
}

export interface CoordinatorAdvisorNotificationRecipientItem {
  advisorUserId: string;
  fullName: string;
  email: string;
  inAppStatus: string;
  emailStatus: string;
  readAt: string | null;
}
```

## 8) Recommended API helper examples

```ts
export async function sendCoordinatorAdvisorNotification(
  input: CoordinatorAdvisorNotificationCreateInput,
): Promise<{ campaignId: string }> {
  const response = await fetch('/api/v1/coordinator/advisors/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to send notification');
  }

  const payload = await response.json();
  return payload.data;
}
```

```ts
export async function fetchCoordinatorAdvisorNotificationHistory(params: {
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const response = await fetch(
    `/api/v1/coordinator/advisors/notifications/history?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to load notification history');
  }

  return response.json();
}
```

## 9) Error handling

Recommended user-facing errors:

- `400`: invalid request data or invalid advisor selection
- `401`: session expired
- `403`: coordinator does not have permission for the target advisors
- `404`: campaign not found
- `409`: duplicate or conflicting request if the backend adds idempotency constraints

Recommended frontend behavior:

1. show inline form validation for bad input
2. show toast for request failures
3. keep draft values when submit fails
4. on `401`, redirect to login flow
5. on `403`, show access-denied state

## 10) QA checklist

- [ ] coordinator can load advisor selector data
- [ ] coordinator can send to one advisor
- [ ] coordinator can send to multiple advisors
- [ ] coordinator can send to all advisors
- [ ] coordinator can choose `IN_APP`
- [ ] coordinator can choose `EMAIL`
- [ ] coordinator can choose `BOTH`
- [ ] coordinator sees summary cards
- [ ] coordinator sees history list
- [ ] coordinator can open one history detail view
- [ ] recipient counts and delivery counters display correctly

## Final note

If backend email delivery webhooks are added later, the frontend can keep the same structure and simply display more accurate email delivery statuses without redesigning the page.