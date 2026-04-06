# Frontend Advisor Milestone Review Integration Guide

This guide explains how the frontend should integrate the advisor-side milestone review workflow.

It covers:

- loading the advisor review queue
- opening the student submission for review
- adding advisor feedback with optional attachment
- reading feedback history for a submission
- approving a milestone submission
- refreshing the advisor dashboard after each action

## Goal

The advisor dashboard should support this flow:

1. Advisor opens the review dashboard.
2. Frontend loads milestones currently waiting for advisor review.
3. Advisor opens a submitted file.
4. Advisor gives feedback, optionally with an attachment.
5. Student resubmits if needed.
6. Advisor reviews the newest version.
7. Advisor approves the final submission.

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

## 1) Main advisor queue endpoint

Use this endpoint for the advisor's own dashboard:

- `GET /api/v1/projects/advisors/me/milestone-review-queue`

There is also a staff-facing version:

- `GET /api/v1/projects/advisors/:id/milestone-review-queue`

Use the staff-facing route only for department staff screens. For the logged-in advisor dashboard, always prefer `/me`.

## 2) What the review queue returns

Each queue item includes:

- `project`
- `group`
- `milestone`
- `latestSubmission`
- `review.feedbackCount`
- `review.latestFeedback`

Example queue item:

```json
{
  "project": {
    "id": "project-1",
    "title": "Research Platform",
    "status": "ACTIVE"
  },
  "group": {
    "id": "group-1",
    "name": "Team Alpha",
    "status": "APPROVED"
  },
  "milestone": {
    "id": "milestone-2",
    "title": "Milestone 2",
    "status": "SUBMITTED",
    "submittedAt": "2026-04-05T09:10:00.000Z"
  },
  "latestSubmission": {
    "id": "submission-8",
    "fileName": "milestone-2-v2.pdf",
    "fileUrl": "https://...",
    "createdAt": "2026-04-05T09:10:00.000Z"
  },
  "review": {
    "feedbackCount": 1,
    "latestFeedback": {
      "id": "feedback-10",
      "message": "Please improve chapter 2.",
      "attachmentUrl": "https://.../review-notes.pdf",
      "createdAt": "2026-04-05T09:30:00.000Z"
    }
  }
}
```

## 3) Recommended advisor dashboard layout

### Review queue list

For each queue item, show:

- project title
- group name
- milestone title
- submitted date
- latest submission file name
- feedback count
- latest feedback preview

### Review detail panel

When advisor opens one item, show:

- student submission file link
- submission metadata
- feedback history
- feedback form
- approve button

## 4) Recommended advisor queue UI rules

For each queue item:

1. if `milestone.status === 'SUBMITTED'` and `review.feedbackCount === 0`
   - show `Review Submission`

2. if `milestone.status === 'SUBMITTED'` and `review.feedbackCount > 0`
   - show `Continue Review`
   - show latest feedback preview

3. after approval
   - remove the item from the queue on the next refresh

Important:

- The queue should only represent milestones still waiting for review.
- After approval, frontend should refetch the queue and expect the approved milestone to disappear.

## 5) Opening the student submission file

Use:

- `latestSubmission.fileUrl`

Frontend should provide a clear action such as:

- `Open Submission`
- `Download Submission`

This file is the student version the advisor is reviewing.

## 6) Feedback creation endpoint

Advisors add feedback using:

- `POST /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

Request type:

- `multipart/form-data`

Fields:

- `message`: required
- `file`: optional PDF or DOCX

This endpoint is used when the advisor wants to:

- request changes
- point out issues
- attach review notes or annotated files

## 7) Example frontend helper for feedback submission

```ts
export async function addMilestoneSubmissionFeedback(params: {
  milestoneId: string;
  submissionId: string;
  message: string;
  file?: File;
  token: string;
}) {
  const formData = new FormData();
  formData.append('message', params.message);

  if (params.file) {
    formData.append('file', params.file);
  }

  const response = await fetch(
    `/api/v1/projects/milestones/${params.milestoneId}/submissions/${params.submissionId}/feedbacks`,
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
    throw error ?? new Error('Failed to add milestone feedback');
  }

  return response.json();
}
```

## 8) Feedback history endpoint

To read the feedback timeline for one submission, use:

- `GET /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

Each feedback item can include:

- `id`
- `message`
- `author`
- `authorRole`
- `createdAt`
- `attachmentFileName`
- `attachmentUrl`

Recommended frontend behavior:

- show latest feedback preview in the queue
- show full feedback history in the review detail panel
- allow advisor to open previously attached review files

## 9) Approval endpoint

Advisors approve a final submission using:

- `PUT /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/approve`

This endpoint is the final review action.

When approval succeeds:

- submission becomes `APPROVED`
- milestone becomes `APPROVED`
- students receive milestone approval notification
- next step in the milestone sequence can proceed

## 10) Example frontend helper for approval

```ts
export async function approveMilestoneSubmission(params: {
  milestoneId: string;
  submissionId: string;
  token: string;
}) {
  const response = await fetch(
    `/api/v1/projects/milestones/${params.milestoneId}/submissions/${params.submissionId}/approve`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw error ?? new Error('Failed to approve milestone submission');
  }

  return response.json();
}
```

## 11) Post-action refresh rules

After advisor posts feedback:

1. close feedback modal or clear form
2. show success toast
3. refetch feedback history for the submission
4. refetch the advisor review queue

Expected result:

- `review.feedbackCount` increases
- `review.latestFeedback` updates
- queue item remains visible because milestone is still pending approval

After advisor approves submission:

1. show success toast
2. refetch advisor review queue
3. close review panel if desired

Expected result:

- approved milestone disappears from the review queue

## 12) Advisor action rules

Use these frontend rules for a selected submission.

### A. Submission exists and is waiting for first review

Condition:

```ts
milestone.status === 'SUBMITTED' && review.feedbackCount === 0
```

UI:

- show `Add Feedback`
- show `Approve`

### B. Submission exists and feedback already exists

Condition:

```ts
milestone.status === 'SUBMITTED' && review.feedbackCount > 0
```

UI:

- show feedback history
- show `Add More Feedback`
- show `Approve`

### C. Submission approved

Condition:

```ts
latestSubmission.status === 'APPROVED' || milestone.status === 'APPROVED'
```

UI:

- treat as completed review
- do not keep it in active queue UI

## 13) Suggested advisor screen states

Use clear labels such as:

- `Review Submission`
- `Continue Review`
- `Feedback Sent`
- `Approve Submission`
- `Approved`

## 14) Suggested implementation order

Implement the advisor-side frontend in this order:

1. Review queue fetch from `GET /api/v1/projects/advisors/me/milestone-review-queue`
2. Queue list UI
3. Submission review detail panel
4. Feedback form with optional file attachment
5. Feedback history timeline
6. Approval action
7. Post-action queue refresh

## 15) Minimal working version

If you want the smallest usable advisor implementation first, build only:

1. review queue list
2. `Open Submission` action
3. feedback form with message only
4. approve button
5. queue refetch after feedback or approval

That is enough to support the full advisor review workflow.

## 16) Final integration rules

Advisor dashboard should use:

- `GET /api/v1/projects/advisors/me/milestone-review-queue`

Advisor feedback action should use:

- `POST /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

Advisor approval action should use:

- `PUT /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/approve`

Feedback history panel should use:

- `GET /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

If frontend follows those four routes and refreshes queue data after every write action, the advisor milestone review flow will stay consistent with backend behavior.