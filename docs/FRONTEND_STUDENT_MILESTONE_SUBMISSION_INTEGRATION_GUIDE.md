# Frontend Student Milestone Submission Integration Guide

This guide explains how the frontend should integrate the student-side milestone submission and resubmission flow.

It covers:

- first milestone submission
- resubmission after advisor feedback
- when upload buttons should appear
- which backend endpoints to call
- what data should drive the UI

## Goal

The student dashboard should support this flow:

1. Student opens the dashboard.
2. Frontend loads the student's approved proposal and linked project.
3. Student uploads the first file for a milestone.
4. Milestone becomes `SUBMITTED`.
5. Advisor reviews the submission.
6. If advisor gives feedback, student can upload a new version.
7. Once the milestone is approved, upload actions stop.

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <token>`

Global success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-06T09:00:00.000Z"
}
```

## 1) Main source of truth

Use this endpoint as the main student dashboard query:

- `GET /api/v1/projects/proposals/group`

This response already includes:

- approved proposal data
- linked project data
- advisor data
- project milestones
- latest submission per milestone
- feedback history for the latest submission
- approval information

Frontend should use this endpoint to render the milestone dashboard state.

## 2) Submission endpoint

Students use the same endpoint for:

- first submission
- resubmission after advisor feedback

Endpoint:

- `POST /api/v1/projects/milestones/:milestoneId/submissions`

Request type:

- `multipart/form-data`

Form fields:

- `file`: required

Allowed file types:

- PDF
- DOCX

Important:

- There is no separate resubmission endpoint.
- Resubmission is just another submission version for the same milestone.

## 3) How frontend gets the milestone id

Frontend should read milestone data from:

- `GET /api/v1/projects/proposals/group`

Use:

- `proposal.project.milestones`

Each milestone object contains:

- `id`
- `title`
- `description`
- `dueDate`
- `status`
- `submissions`

Example:

```json
{
  "id": "ae785e0b-eb9d-4f14-9204-61c69e15e39d",
  "title": "Software Requirements Specification (SRS)",
  "status": "SUBMITTED",
  "submissions": []
}
```

Use that `id` as `milestoneId` when uploading or resubmitting.

## 4) Frontend milestone state model

For each milestone, compute the current state from:

- `milestone.status`
- `milestone.submissions[0]`
- `milestone.submissions[0].feedbacks`

Recommended frontend helpers:

```ts
const latestSubmission = milestone.submissions?.[0] ?? null;
const feedbacks = latestSubmission?.feedbacks ?? [];
const hasFeedback = feedbacks.length > 0;
const isApproved =
  milestone.status === 'APPROVED' || latestSubmission?.status === 'APPROVED';

const canUploadFirst = !latestSubmission;
const canResubmit = !!latestSubmission && hasFeedback && !isApproved;
const waitingForReview = !!latestSubmission && !hasFeedback && !isApproved;
```

## 5) UI rules for upload and resubmission

### State A: No submission yet

Condition:

```ts
!latestSubmission
```

UI:

- show `Upload Submission`

Behavior:

- student uploads first file
- frontend refetches dashboard data
- milestone becomes `SUBMITTED`

### State B: Submission exists, no feedback yet, not approved

Condition:

```ts
!!latestSubmission && !hasFeedback && !isApproved
```

UI:

- show `Awaiting Advisor Review`
- show `View Submission`

Behavior:

- do not show `Resubmit`
- student should wait for advisor review

### State C: Submission exists, feedback exists, not approved

Condition:

```ts
!!latestSubmission && hasFeedback && !isApproved
```

UI:

- show `View Feedback`
- show `Resubmit`
- show `Open Advisor Attachment` when feedback attachment exists

Behavior:

- student can upload a new version for the same milestone
- frontend should use the same submission endpoint again

### State D: Approved milestone

Condition:

```ts
isApproved
```

UI:

- show `Approved`
- show `View Submission`
- show `View Feedback`

Behavior:

- do not show upload or resubmit actions

## 6) Recommended upload modal

Use one upload modal for both:

- first submission
- resubmission

Suggested fields:

- file input
- selected file preview
- submit button

Suggested validation:

- require one file
- only allow `.pdf` and `.docx`
- show error if invalid type is selected

## 7) Example frontend upload helper

```ts
export async function uploadMilestoneSubmission(params: {
  milestoneId: string;
  file: File;
  token: string;
}) {
  const formData = new FormData();
  formData.append('file', params.file);

  const response = await fetch(
    `/api/v1/projects/milestones/${params.milestoneId}/submissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw error ?? new Error('Failed to upload milestone submission');
  }

  return response.json();
}
```

## 8) Post-upload refresh behavior

After upload succeeds:

1. close the upload modal
2. show success toast
3. refetch `GET /api/v1/projects/proposals/group`
4. rerender milestone cards

Expected result after first upload:

- milestone state changes from `PENDING` to `SUBMITTED`

Expected result after resubmission:

- new latest submission becomes active
- milestone remains under review until advisor approves it
- card should return to `Awaiting Advisor Review`

## 9) Feedback rendering

Frontend should read feedback from:

- `milestone.submissions[0].feedbacks`

Each feedback item can include:

- `message`
- `author`
- `authorRole`
- `createdAt`
- `attachmentFileName`
- `attachmentUrl`

Suggested UI:

- show a short feedback preview on the milestone card
- show a full feedback timeline in an expandable section or side panel

## 10) Approval rendering

Frontend should show approval data from:

- `milestone.status`
- `latestSubmission.status`
- `latestSubmission.approvedAt`
- `latestSubmission.approvedBy`

When milestone is approved:

- show approved badge
- show approved date
- show approver name
- show final submission file link
- keep feedback history visible as read-only history

## 11) Notifications integration

Use this endpoint for milestone notifications:

- `GET /api/v1/notifications?eventTypes=MILESTONE_FEEDBACK_ADDED,MILESTONE_APPROVED`

Recommended behavior:

### When `MILESTONE_FEEDBACK_ADDED` is received

- highlight the milestone card
- show a `Feedback Received` badge or chip
- refetch `GET /api/v1/projects/proposals/group`

### When `MILESTONE_APPROVED` is received

- highlight the approved milestone
- show success state
- refetch `GET /api/v1/projects/proposals/group`

Important:

- Notifications are for attention only.
- The actual milestone state should still come from `GET /api/v1/projects/proposals/group`.

## 12) Recommended dashboard layout

### Project header

Show:

- project title
- advisor name
- overall progress

### Milestone list

For each milestone, show:

- milestone title
- due date
- status badge
- latest submission file
- main action button

### Milestone detail section

When expanded, show:

- latest submission metadata
- feedback timeline
- advisor attachment links
- approval data

### Upload modal

Use for:

- first upload
- resubmission after feedback

## 13) Recommended status labels

Use these student-facing labels:

- `Upload Submission`
- `Awaiting Advisor Review`
- `Feedback Received`
- `Resubmit`
- `Approved`

## 14) Suggested implementation order

Implement the frontend in this order:

1. Load dashboard data from `GET /api/v1/projects/proposals/group`
2. Render milestone cards using status-based rules
3. Add upload modal
4. Add upload submit handler
5. Refetch dashboard after upload
6. Render feedback history and advisor attachments
7. Render approval state
8. Add notification-driven refresh/highlight

## 15) Final frontend rules

Student can upload when:

- there is no submission yet

Student can resubmit when:

- latest submission exists
- latest submission has feedback
- milestone is not approved

Student cannot upload when:

- milestone is approved
- latest submission is waiting for review and has no feedback yet

## 16) Minimal working version

If frontend wants the smallest working version first, implement only:

1. dashboard fetch from `GET /api/v1/projects/proposals/group`
2. milestone list with status badges
3. upload modal
4. upload action using `POST /api/v1/projects/milestones/:milestoneId/submissions`
5. post-upload refetch
6. feedback preview block
7. approved badge block

This is enough to support first submission, feedback-driven resubmission, and final approval visibility.