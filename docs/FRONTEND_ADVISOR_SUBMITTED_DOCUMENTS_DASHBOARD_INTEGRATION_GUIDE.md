# Frontend Advisor Submitted Documents Dashboard Integration Guide

This guide explains how the frontend should integrate the advisor dashboard view for milestone submission documents across all assigned project groups.

It covers:

- advisor dashboard summary cards
- document table rows
- derived dashboard statuses
- which backend endpoint to call
- how to render approved, pending review, and revision requested items

## Goal

The advisor dashboard should show:

1. all latest milestone submission documents across the advisor's assigned project groups
2. summary totals for submitted documents
3. a table or list that advisors can inspect and open from one screen

The dashboard should support these summary cards:

- total submitted documents
- approved
- pending review
- revision requested

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

## 1) Main advisor dashboard endpoint

For the logged-in advisor dashboard, use:

- `GET /api/v1/projects/advisors/me/submitted-documents`

There is also a staff-facing version:

- `GET /api/v1/projects/advisors/:id/submitted-documents`

Use the `:id` route only for department staff dashboards or admin-style views. For advisor self dashboards, use `/me`.

## 2) What this endpoint returns

The response contains:

1. `summary`
2. `documents`

### Summary

`summary` contains:

- `totalSubmittedDocuments`
- `approved`
- `pendingReview`
- `revisionRequested`

### Documents

Each `documents` item represents the latest submission for one milestone.

Each item includes:

- `submissionId`
- `documentName`
- `status`
- `submissionStatus`
- `sizeBytes`
- `mimeType`
- `fileUrl`
- `uploadedAt`
- `approvedAt`
- `project`
- `group`
- `milestone`
- `uploadedBy`
- `review`

## 3) Example response shape

```json
{
  "summary": {
    "totalSubmittedDocuments": 12,
    "approved": 4,
    "pendingReview": 5,
    "revisionRequested": 3
  },
  "documents": [
    {
      "submissionId": "submission-1",
      "documentName": "SRS-v2.docx",
      "status": "REVISION_REQUESTED",
      "submissionStatus": "SUBMITTED",
      "sizeBytes": 702584,
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "fileUrl": "https://...",
      "uploadedAt": "2026-04-06T10:20:00.000Z",
      "approvedAt": null,
      "project": {
        "id": "project-1",
        "title": "Academic Project Platform",
        "status": "ACTIVE"
      },
      "group": {
        "id": "group-1",
        "name": "Tech Innovators"
      },
      "milestone": {
        "id": "milestone-2",
        "title": "Software Requirements Specification (SRS)",
        "description": "Submit SRS document",
        "dueDate": "2026-06-08T21:01:40.587Z",
        "status": "SUBMITTED",
        "submittedAt": "2026-04-06T10:20:00.000Z"
      },
      "uploadedBy": {
        "id": "student-1",
        "firstName": "Kubsa",
        "lastName": "Melkamu",
        "email": "kubsa@academia.et",
        "avatarUrl": null
      },
      "review": {
        "feedbackCount": 1,
        "latestFeedbackAt": "2026-04-06T11:00:00.000Z",
        "latestFeedbackMessage": "Please revise section 2.",
        "latestFeedbackAttachmentUrl": "https://.../review.pdf",
        "latestFeedbackAttachmentFileName": "review.pdf",
        "latestFeedbackAuthorRole": "Advisor",
        "latestFeedbackAuthor": {
          "id": "advisor-1",
          "firstName": "Shambel",
          "lastName": "Adunya",
          "email": "advisor@example.com",
          "avatarUrl": null
        }
      }
    }
  ]
}
```

## 4) Meaning of document status

The dashboard `status` field is derived for frontend reporting and cards.

It can be one of:

- `APPROVED`
- `PENDING_REVIEW`
- `REVISION_REQUESTED`

### Derived rules

#### Approved

Use when:

- `submissionStatus === 'APPROVED'`

#### Pending review

Use when:

- submission is not approved
- latest submission has no feedback yet

#### Revision requested

Use when:

- submission is not approved
- latest submission has one or more feedback entries

Important:

- `REVISION_REQUESTED` is currently derived, not stored as a database submission status.

## 5) Recommended dashboard layout

### Summary cards

Render four summary cards:

1. `Total Submitted Documents`
2. `Approved`
3. `Pending Review`
4. `Revision Requested`

### Documents table or list

For each row, render:

1. document name
2. milestone title
3. project group name
4. project title
5. uploaded by
6. status badge
7. size
8. uploaded time
9. latest feedback summary
10. open document action

## 6) Recommended table columns

Suggested columns:

1. `Document`
2. `Milestone`
3. `Project Group`
4. `Project`
5. `Uploaded By`
6. `Status`
7. `Size`
8. `Uploaded At`
9. `Review`
10. `Actions`

Suggested actions:

1. `Open Submission`
2. `Open Review Attachment` when review attachment exists
3. `Open Review Panel`

## 7) Frontend state rules

For each document row:

### A. Pending review

Condition:

```ts
document.status === 'PENDING_REVIEW'
```

UI:

- show yellow or neutral badge
- show `Awaiting Advisor Review`
- highlight `Open Submission`

### B. Revision requested

Condition:

```ts
document.status === 'REVISION_REQUESTED'
```

UI:

- show warning badge
- show latest feedback preview
- show review attachment link if present

### C. Approved

Condition:

```ts
document.status === 'APPROVED'
```

UI:

- show success badge
- show approved timestamp if available

## 8) Recommended frontend types

```ts
export interface AdvisorSubmittedDocumentsSummary {
  totalSubmittedDocuments: number;
  approved: number;
  pendingReview: number;
  revisionRequested: number;
}

export interface AdvisorSubmittedDocumentRow {
  submissionId: string;
  documentName: string;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'REVISION_REQUESTED';
  submissionStatus: string;
  sizeBytes: number;
  mimeType: string;
  fileUrl: string;
  filePublicId: string;
  resourceType: string;
  uploadedAt: string;
  approvedAt: string | null;
  project: {
    id: string;
    title: string;
    status: string;
  };
  group: {
    id: string;
    name: string;
  } | null;
  milestone: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    status: string;
    submittedAt: string | null;
  };
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  review: {
    feedbackCount: number;
    latestFeedbackAt: string | null;
    latestFeedbackMessage: string | null;
    latestFeedbackAttachmentUrl: string | null;
    latestFeedbackAttachmentFileName: string | null;
    latestFeedbackAuthorRole: string | null;
    latestFeedbackAuthor: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  };
}
```

## 9) Frontend fetch example

```ts
export async function getAdvisorSubmittedDocuments(token: string) {
  const response = await fetch('/api/v1/projects/advisors/me/submitted-documents', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw error ?? new Error('Failed to fetch advisor submitted documents');
  }

  return response.json();
}
```

## 10) Recommended interaction flow

### Step 1

Load advisor submitted-documents dashboard:

- `GET /api/v1/projects/advisors/me/submitted-documents`

### Step 2

Render summary cards from:

- `data.summary`

### Step 3

Render document rows from:

- `data.documents`

### Step 4

When advisor opens a row:

1. open the submission file using `fileUrl`
2. show milestone metadata
3. show latest feedback preview
4. optionally link into the full review flow

### Step 5

If advisor gives feedback or approves the milestone elsewhere in the dashboard:

1. refetch this endpoint
2. refresh summary cards
3. refresh the documents table

## 11) Relationship to the review queue

This endpoint is broader than:

- `GET /api/v1/projects/advisors/me/milestone-review-queue`

Difference:

- review queue only shows active milestones waiting for review
- submitted-documents dashboard also includes approved document rows and aggregated counts

Recommended frontend usage:

1. use `milestone-review-queue` for active review work
2. use `submitted-documents` for advisor dashboard reporting and tracking

## 12) Minimal working version

If you want the smallest useful version first, build only:

1. summary cards
2. documents table
3. status badges
4. open submission action
5. latest feedback preview

That is enough to support the advisor dashboard reporting requirement.