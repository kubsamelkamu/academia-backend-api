# Frontend Coordinator Evaluator Notifications Stepwise Implementation Guide

This guide is a practical step-by-step plan for integrating the Coordinator -> Evaluator Notifications feature into the frontend.

It is based on the backend that is already implemented in the repository.

## Purpose

Use this guide when implementing the frontend in a controlled order so that each piece can be verified before moving on.

This guide focuses on:

1. what is already done in the backend
2. what the frontend should build first
3. which API to connect at each step
4. what each screen should display
5. how to test each step before moving on

## What Is Already Done In The Backend

The backend implementation for this feature is already in place.

### Implemented backend capabilities

1. Coordinator can send notifications to one evaluator, multiple evaluators, or all eligible evaluators in the same department.
2. Delivery methods supported are `IN_APP`, `EMAIL`, and `BOTH`.
3. Notification campaigns are stage-aware using `CAPSTONE_I` and `CAPSTONE_II`.
4. A full campaign history is stored.
5. Each recipient has per-channel delivery status.
6. Summary metrics are available for the frontend.
7. History list and history detail endpoints are available.
8. Email jobs are queued and processed by the worker.
9. Email webhook handling exists for later confirmed delivery updates.

## Main Frontend Endpoints

The frontend should use these endpoints:

1. `GET /api/v1/coordinator/evaluators/notifications/recipients`
2. `POST /api/v1/coordinator/evaluators/notifications`
3. `GET /api/v1/coordinator/evaluators/notifications/history/summary`
4. `GET /api/v1/coordinator/evaluators/notifications/history`
5. `GET /api/v1/coordinator/evaluators/notifications/history/:campaignId`

## Important ID Rule

When sending notification requests:

1. use `evaluatorUserId`
2. always send `evaluatorUserIds` as an array
3. even for `SINGLE`, use `evaluatorUserIds: ["..."]`

## Recommended Frontend Build Order

Build the frontend in this order:

1. stage selector and evaluator recipient lookup
2. summary cards
3. history list page
4. history detail view
5. send notification form
6. send action integration
7. post-send refresh flow
8. optional status polling

This order gives you visibility first, then composition and sending second.

---

## Step 1: Build The Stage Selector And Recipient Data Source

### Goal

Load valid evaluators for the coordinator's department and selected stage, then use that dataset in the notification form.

### Endpoint

`GET /api/v1/coordinator/evaluators/notifications/recipients?stage=CAPSTONE_I&page=1&limit=20&search=`

### Fields the frontend should store

From each evaluator item, keep:

1. `evaluatorUserId`
2. `fullName`
3. `email`
4. `avatarUrl`
5. `assignedProjectsCount`
6. `pendingEvaluationsCount`
7. `submittedEvaluationsCount`

### UI output for this step

Create a reusable evaluator option shape such as:

```ts
type EvaluatorOption = {
  evaluatorUserId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  assignedProjectsCount: number;
  pendingEvaluationsCount: number;
  submittedEvaluationsCount: number;
};
```

### Validation for this step

Confirm that:

1. the request succeeds with coordinator auth
2. changing stage changes the eligible evaluator list
3. the value used in UI selection is `evaluatorUserId`

---

## Step 2: Build The Notifications Page Shell

### Goal

Create the main page layout before wiring the send form.

### Recommended page sections

1. page header
2. stage filter bar
3. summary cards row
4. `Send Notification` button
5. history table or history cards
6. history detail drawer or route

### Recommended page title

`Coordinator Evaluator Notifications`

### Recommended layout behavior

1. show stage filter near the top
2. show summary directly under the filter
3. show history list in the main content area
4. open detail in a side drawer or separate page

---

## Step 3: Integrate Summary Cards

### Goal

Show top-level metrics for notification campaigns.

### Endpoint

`GET /api/v1/coordinator/evaluators/notifications/history/summary?stage=CAPSTONE_I`

### Suggested cards

1. `Total Sent`
2. `Delivered`
3. `Total Reached`

### Optional secondary cards

1. `In-App Delivered`
2. `Email Queued`
3. `Email Accepted`
4. `Email Delivered`
5. `Email Failed`

### Suggested field mapping

1. `Total Sent` -> `totalSent`
2. `Delivered` -> `delivered`
3. `Total Reached` -> `totalReached`
4. `In-App Delivered` -> `inAppDelivered`
5. `Email Queued` -> `emailQueued`
6. `Email Accepted` -> `emailAccepted`
7. `Email Delivered` -> `emailDelivered`
8. `Email Failed` -> `emailFailed`

### Important note

At the backend level, a campaign may count as delivered before final email delivery confirmation is available. If you want stricter frontend labels, prefer:

1. `Delivered Campaigns`
2. `Email Accepted`
3. `Email Delivered`

instead of relying on a single generic delivery label.

---

## Step 4: Integrate The History List

### Goal

Show all previously sent evaluator notification campaigns.

### Endpoint

`GET /api/v1/coordinator/evaluators/notifications/history?page=1&limit=10&stage=CAPSTONE_I`

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

### Recommended frontend controls

1. stage tabs or stage select
2. search input
3. priority filter
4. delivery method filter
5. pagination controls

### Validation for this step

Confirm that:

1. history renders correctly
2. stage filter changes the list as expected
3. search and filters affect the result list correctly

---

## Step 5: Integrate The History Detail View

### Goal

Display one campaign and all recipients with their delivery states.

### Endpoint

`GET /api/v1/coordinator/evaluators/notifications/history/:campaignId`

### Recommended detail sections

1. subject and message
2. stage, priority, and delivery method badges
3. campaign totals block
4. recipient results table

### Recommended recipient fields

1. `fullName`
2. `email`
3. `inAppStatus`
4. `emailStatus`
5. `readAt`
6. `emailFailureReason`

### Recommended UI behavior

1. show `emailFailureReason` only when `emailStatus` is `FAILED`
2. show `readAt` as `Not read` when null
3. treat `ACCEPTED` and `DELIVERED` as different states

---

## Step 6: Build The Send Notification Form

### Goal

Allow the coordinator to compose and submit a new evaluator notification campaign.

### Endpoint

`POST /api/v1/coordinator/evaluators/notifications`

### Required frontend form fields

1. `stage`
2. `recipientMode`
3. `evaluatorUserIds` when mode is `SINGLE` or `MULTIPLE`
4. `priority`
5. `deliveryMethod`
6. `subject`
7. `message`

### Recommended UI rules

1. disable submit until all required fields are valid
2. clear selected evaluators when stage changes
3. hide evaluator selector when `recipientMode` is `ALL`
4. show live eligible count for `ALL`
5. show single-select UI for `SINGLE`
6. show multi-select UI for `MULTIPLE`

---

## Step 7: Integrate The Send Action

### Goal

Send the form data to the backend and reflect the returned campaign state in the UI.

### Recommended success flow

1. show success toast
2. close modal or reset the form
3. refresh summary cards
4. refresh history list
5. optionally open the new campaign detail immediately using returned `campaignId`

### Recommended failure flow

1. show backend validation message directly if it is user-actionable
2. keep form values intact after failure
3. if recipient scope fails, refresh the recipient lookup for the selected stage

---

## Step 8: Optional Polling For Status Progression

### Goal

Keep history data fresh while queued or accepted email statuses are still progressing.

### Recommended approach

1. poll summary and visible history list every 20 to 30 seconds while the page is open
2. poll history detail when the selected campaign has queued or accepted email statuses
3. stop polling when the page is hidden if your app already refreshes on focus

### Important note

Polling is optional. The first working version does not require realtime updates.

---

## Recommended Testing Sequence

Test the frontend in this order:

1. load recipients for `CAPSTONE_I`
2. switch to `CAPSTONE_II` and confirm list changes
3. load summary cards
4. load history list
5. open one history detail
6. send a `SINGLE` notification with `IN_APP`
7. send a `MULTIPLE` notification with `BOTH`
8. send an `ALL` notification for one stage
9. confirm new campaigns appear in history and detail views

## Practical frontend outcome

After these steps, the frontend should support:

1. stage-aware evaluator selection
2. campaign sending for one, many, or all evaluators
3. summary metrics for evaluator notification campaigns
4. searchable and filterable history
5. per-recipient delivery inspection