# Frontend Coordinator Advisor Notifications Stepwise Implementation Guide

This guide is a practical step-by-step implementation plan for integrating the **Coordinator -> Advisor Notifications** feature into the frontend.

It is based on the backend that is already implemented and live.

## Purpose

Use this guide when implementing the frontend in a controlled order so that each piece can be verified before moving to the next one.

This guide focuses on:

1. what is already done in the backend
2. what the frontend should build first
3. which API to connect at each step
4. what each screen should display
5. how to test each step before moving on

## What Is Already Done In The Backend

The backend implementation for this feature is already in place.

### Implemented backend capabilities

1. Coordinator can send notifications to one advisor, multiple advisors, or all advisors in the same department.
2. Delivery methods supported are `IN_APP`, `EMAIL`, and `BOTH`.
3. A full campaign history is stored.
4. Each recipient has a per-channel delivery status.
5. Summary metrics are available for the frontend.
6. History list and history detail endpoints are available.
7. Email jobs are queued and processed by the worker.
8. Brevo acceptance is tracked.
9. Email webhook handling exists for future confirmed delivery updates.

### Verified live behavior

The following has already been verified against the deployed backend:

1. Coordinator authorization works.
2. Department isolation works.
3. Advisor selection must use `advisorId` from advisor overview.
4. Email campaigns can be created successfully.
5. Email queue processing works.
6. Brevo accepts outbound email and returns a provider message id.

## Main Frontend Endpoints

The frontend should use these endpoints:

1. `GET /api/v1/analytics/advisors/overview`
2. `POST /api/v1/coordinator/advisors/notifications`
3. `GET /api/v1/coordinator/advisors/notifications/history/summary`
4. `GET /api/v1/coordinator/advisors/notifications/history`
5. `GET /api/v1/coordinator/advisors/notifications/history/:campaignId`

## Important ID Rule

When sending notification requests:

1. use `advisorId`
2. do not use `advisorProfileId`

Also:

1. always send `advisorUserIds` as an array
2. even for `SINGLE`, use `advisorUserIds: ["..."]`

## Recommended Frontend Build Order

Build the frontend in this order:

1. advisor selector data source
2. summary cards
3. history list page
4. history detail view
5. send notification form
6. send action integration
7. post-send refresh flow
8. optional polling for email status progression

This order gives you visibility first, then composition and sending second.

---

## Step 1: Build The Advisor Selector Data Source

### Goal

Load valid advisors for the coordinator's department and use the returned values in the notification form.

### Endpoint

`GET /api/v1/analytics/advisors/overview?page=1&limit=100&search=`

### Fields the frontend should store

From each advisor item, keep:

1. `advisorId`
2. `fullName`
3. `email`
4. `avatarUrl`
5. `status`
6. `currentLoad`
7. `availableCapacity`

### UI output for this step

Create a reusable advisor option shape such as:

```ts
type AdvisorOption = {
  advisorId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  currentLoad: number;
  availableCapacity: number;
};
```

### Validation for this step

Confirm that:

1. the request succeeds with coordinator auth
2. advisors belong to the coordinator's department
3. the value used in UI selection is `advisorId`

---

## Step 2: Build The Notifications Page Shell

### Goal

Create the main page layout before wiring the send form.

### Recommended page sections

1. page header
2. summary cards row
3. `Send Notification` button
4. history table or history cards
5. history detail drawer or route

### Recommended page title

`Coordinator Advisor Notifications`

### Recommended layout behavior

1. show summary at the top
2. show history list in the main content area
3. open detail in a side drawer or separate page

---

## Step 3: Integrate Summary Cards

### Goal

Show top-level metrics for the notification campaigns.

### Endpoint

`GET /api/v1/coordinator/advisors/notifications/history/summary`

### Suggested cards

1. `Total Sent`
2. `Delivered`
3. `Total Reached`

### Optional secondary cards

1. `Email Accepted`
2. `Email Delivered`
3. `In-App Delivered`
4. `Email Failed`

### Suggested field mapping

1. `Total Sent` -> `totalSent`
2. `Delivered` -> `delivered`
3. `Total Reached` -> `totalReached`
4. `Email Accepted` -> `emailAccepted`
5. `Email Delivered` -> `emailDelivered`
6. `In-App Delivered` -> `inAppDelivered`
7. `Email Failed` -> `emailFailed`

### Important note

At the backend level, a campaign may count as delivered once email is accepted by the provider. If you want a stricter frontend label, consider displaying:

1. `Delivered Campaigns`
2. `Email Accepted`
3. `Email Delivered`

instead of using only a single generic delivery label.

---

## Step 4: Integrate The History List

### Goal

Show all previously sent notification campaigns.

### Endpoint

`GET /api/v1/coordinator/advisors/notifications/history?page=1&limit=10`

### Recommended columns

1. `subject`
2. `priority`
3. `deliveryMethod`
4. `recipientMode`
5. `totalReachedCount`
6. `inAppDeliveredCount`
7. `emailAcceptedCount`
8. `emailDeliveredCount`
9. `emailFailedCount`
10. `createdAt`
11. `view details`

### Recommended filtering support

The backend supports:

1. `page`
2. `limit`
3. `deliveryMethod`
4. `priority`
5. `search`

### Recommended frontend controls

1. search input
2. priority filter
3. delivery method filter
4. pagination controls

### Validation for this step

Confirm that:

1. history renders correctly
2. the latest campaign appears after sending
3. filters affect the result list correctly

---

## Step 5: Integrate The History Detail View

### Goal

Display one campaign and all recipients with their delivery states.

### Endpoint

`GET /api/v1/coordinator/advisors/notifications/history/:campaignId`

### Recommended sections

1. campaign metadata
2. subject and message content
3. campaign counters
4. recipient delivery table

### Recommended recipient table columns

1. `fullName`
2. `email`
3. `inAppStatus`
4. `emailStatus`
5. `readAt`
6. `emailFailureReason`

### Email status meaning

Use these labels in the frontend:

1. `QUEUED` -> `Queued`
2. `ACCEPTED` -> `Accepted by provider`
3. `DELIVERED` -> `Delivered`
4. `FAILED` -> `Failed`
5. `NOT_REQUESTED` -> `Not requested`

### Validation for this step

Confirm that:

1. one campaign can be opened from the list
2. recipient rows are displayed
3. email and in-app statuses are visible

---

## Step 6: Build The Send Notification Form

### Goal

Allow a coordinator to create a notification campaign.

### Form fields

1. `recipientMode`
2. `advisorUserIds`
3. `priority`
4. `deliveryMethod`
5. `subject`
6. `message`

### Supported values

#### recipientMode

1. `SINGLE`
2. `MULTIPLE`
3. `ALL`

#### deliveryMethod

1. `IN_APP`
2. `EMAIL`
3. `BOTH`

#### priority

1. `INFO`
2. `HIGH`
3. `CRITICAL`

### Recommended UI rules

1. If `recipientMode = SINGLE`, allow only one advisor selection.
2. If `recipientMode = MULTIPLE`, allow multiple advisor selection.
3. If `recipientMode = ALL`, hide the advisor selector.
4. `subject` is required.
5. `message` is required.
6. `priority` is required.
7. `deliveryMethod` is required.

### Recommended field behavior

1. show advisor autocomplete when mode is `SINGLE` or `MULTIPLE`
2. show recipient count preview when mode is `ALL`
3. show delivery method options clearly as selectable channel badges or a dropdown

---

## Step 7: Connect The Send Action

### Goal

Submit the composed campaign to the backend.

### Endpoint

`POST /api/v1/coordinator/advisors/notifications`

### Example request body for single advisor

```json
{
  "recipientMode": "SINGLE",
  "advisorUserIds": ["a37b737f-4219-4d26-add7-18d0fdbd24ac"],
  "priority": "HIGH",
  "deliveryMethod": "EMAIL",
  "subject": "Live Email Verification",
  "message": "This is the first live coordinator email verification test."
}
```

### Example request body for multiple advisors

```json
{
  "recipientMode": "MULTIPLE",
  "advisorUserIds": [
    "advisor-id-1",
    "advisor-id-2"
  ],
  "priority": "INFO",
  "deliveryMethod": "BOTH",
  "subject": "Reminder",
  "message": "Please review pending work."
}
```

### Example request body for all advisors

```json
{
  "recipientMode": "ALL",
  "priority": "HIGH",
  "deliveryMethod": "IN_APP",
  "subject": "Department Notice",
  "message": "This is a notice for all advisors in the department."
}
```

### Success behavior

After submit succeeds:

1. show toast success
2. reset or close the form
3. refresh summary
4. refresh history list
5. optionally open the new campaign detail using returned `campaignId`

---

## Step 8: Add Post-Send Detail Refresh

### Goal

Show email state progression after sending.

### Why this matters

An email campaign does not always stop at `QUEUED`.

The status can move through:

1. `QUEUED`
2. `ACCEPTED`
3. `DELIVERED` or `FAILED`

### Recommended frontend behavior

After successful send with `EMAIL` or `BOTH`:

1. open the detail view
2. refetch detail after 10 to 20 seconds
3. stop polling when the recipient status is no longer `QUEUED`

### Recommended polling scope

Poll only the detail view, not the whole history table.

---

## Step 9: Handle Errors Cleanly

### Common backend errors

#### `403 Forbidden`

Possible messages:

1. `One or more selected advisors are outside your department`
2. other tenant or department permission issues

Frontend meaning:

1. selected advisor is invalid for this coordinator
2. wrong id type may have been used

#### `400 Bad Request`

Frontend meaning:

1. required field missing
2. invalid enum value
3. malformed body

#### `404 Not Found`

Frontend meaning:

1. selected history item no longer exists

### Recommended UI handling

1. keep form state on submission failure
2. show inline validation when possible
3. show toast for API failure
4. show empty state if no history exists yet

---

## Step 10: Suggested Frontend Type Definitions

```ts
export type RecipientMode = 'SINGLE' | 'MULTIPLE' | 'ALL';
export type DeliveryMethod = 'IN_APP' | 'EMAIL' | 'BOTH';
export type NotificationPriority = 'INFO' | 'HIGH' | 'CRITICAL';

export interface SendCoordinatorAdvisorNotificationInput {
  recipientMode: RecipientMode;
  advisorUserIds?: string[];
  priority: NotificationPriority;
  deliveryMethod: DeliveryMethod;
  subject: string;
  message: string;
}

export interface NotificationHistorySummary {
  totalSent: number;
  delivered: number;
  totalReached: number;
  inAppDelivered: number;
  emailQueued: number;
  emailAccepted: number;
  emailDelivered: number;
  emailFailed: number;
}

export interface NotificationRecipientRow {
  advisorUserId: string;
  fullName: string;
  email: string;
  inAppStatus: string;
  emailStatus: string;
  emailFailureReason: string | null;
  readAt: string | null;
}
```

---

## Step 11: Suggested Implementation Checklist

Use this as your working checklist:

- [ ] Load advisor options from advisor overview
- [ ] Render page shell
- [ ] Render summary cards
- [ ] Render history list
- [ ] Render history detail view
- [ ] Build send form
- [ ] Connect send form to API
- [ ] Refresh summary and history after successful send
- [ ] Open new campaign detail after successful send
- [ ] Add detail polling for email progression
- [ ] Add error handling

---

## Step 12: Recommended Validation Sequence During Frontend Integration

### First validation

1. Load advisors successfully
2. Load summary successfully
3. Load history successfully

### Second validation

1. Send `IN_APP` single-recipient campaign
2. Confirm it appears in history
3. Confirm detail shows `inAppStatus = DELIVERED`

### Third validation

1. Send `EMAIL` single-recipient campaign
2. Confirm detail shows `emailStatus = QUEUED` or `ACCEPTED`
3. Confirm later update to `DELIVERED` when webhook completes

### Fourth validation

1. Send `BOTH` campaign
2. Confirm both in-app and email fields are shown correctly

---

## Final Recommendation

Do not start with the send form first.

The safest and clearest frontend order is:

1. advisor source
2. summary
3. history list
4. history detail
5. send form
6. send flow

That way:

1. you can inspect live backend data immediately
2. you can validate campaign structure before sending new data
3. debugging is easier because the read flow exists before the write flow

## Reference Documents

For the fuller API contract, also see:

1. [docs/FRONTEND_COORDINATOR_ADVISOR_NOTIFICATIONS_INTEGRATION_GUIDE.md](c:\Users\RobaTech\academic-project-platform-backend\docs\FRONTEND_COORDINATOR_ADVISOR_NOTIFICATIONS_INTEGRATION_GUIDE.md)
2. [docs/COORDINATOR_ADVISOR_NOTIFICATIONS_PLAN.md](c:\Users\RobaTech\academic-project-platform-backend\docs\COORDINATOR_ADVISOR_NOTIFICATIONS_PLAN.md)