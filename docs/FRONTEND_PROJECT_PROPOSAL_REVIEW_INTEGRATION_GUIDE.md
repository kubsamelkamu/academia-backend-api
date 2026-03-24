# Frontend Project Proposal Review Integration Guide

This guide covers the proposal flow where a Group Leader submits exactly **3 candidate project titles**, and Coordinator/Department Head approves or rejects.

## Base

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <token>`
- Tag: `Project Management`

## Roles

- Student (approved Group Leader): create draft, submit, list own proposals.
- Coordinator / Department Head: approve or reject submitted proposals.

## 1) Create proposal draft (Student Group Leader)

- `POST /projects/proposals`

Request body:

```json
{
  "titles": [
    "AI-Based Attendance",
    "Smart Campus Navigation",
    "Adaptive Learning Assistant"
  ],
  "description": "Project summary...",
  "documents": []
}
```

Validation:

- `titles` must contain exactly 3 values.
- All 3 titles must be non-empty and unique.
- `description` is required.

Behavior:

- Backend stores all candidate titles in `proposedTitles`.
- Backend sets `title` to the first candidate as default placeholder before approval.
- Initial status is `DRAFT`.

## 2) Submit proposal for review (Student Group Leader)

- `POST /projects/proposals/:id/submit`

Behavior:

- Allowed from `DRAFT` or `REJECTED`.
- Moves status to `SUBMITTED`.
- Sends `PROPOSAL_SUBMITTED` notifications to Coordinator and Department Head in same department.

## 3) List my proposals (Student Group Leader)

- `GET /projects/proposals/me`

Use this endpoint for student dashboard list/history.

## 4) Reviewer decision (Coordinator / Department Head)

- `PUT /projects/proposals/:id/status`

### Approve request

```json
{
  "status": "APPROVED",
  "advisorId": "advisor-user-id",
  "approvedTitleIndex": 1
}
```

Rules:

- Proposal must be in `SUBMITTED`.
- `advisorId` is required and must belong to same tenant + department.
- `approvedTitleIndex` is required and must be `0`, `1`, or `2`.
- Backend sets final `title` from the selected index and stores `selectedTitleIndex`.

### Reject request

```json
{
  "status": "REJECTED",
  "feedback": "Refine scope and references."
}
```

Rules:

- Proposal must be in `SUBMITTED`.
- `feedback` is required.

### Reviewer response shape

Decision response includes existing proposal data plus:

```json
{
  "reviewSummary": {
    "proposalId": "...",
    "decision": "APPROVED",
    "selectedTitleIndex": 1,
    "selectedTitle": "Smart Campus Navigation",
    "advisorId": "advisor-user-id",
    "feedback": null,
    "reviewedByUserId": "reviewer-user-id",
    "updatedAt": "2026-03-23T10:00:00.000Z"
  }
}
```

## 5) Notifications used in this flow

- `PROPOSAL_SUBMITTED` (to Coordinator + Department Head)
- `PROPOSAL_APPROVED` (to submitter/group)
- `PROPOSAL_REJECTED` (to submitter/group)

## 6) Create project from approved proposal (Step 3)

- `POST /projects`

Request body:

```json
{
  "proposalId": "proposal-id"
}
```

Strict backend contract:

- Proposal must be `APPROVED`.
- Proposal must have `advisorId` assigned from approval decision.
- Proposal must have valid `selectedTitleIndex` (`0..2`).
- Proposal must still have 3 candidate titles context.
- Stored proposal `title` must match the reviewer-selected title.

Create response includes:

```json
{
  "creationSummary": {
    "projectId": "project-id",
    "proposalId": "proposal-id",
    "finalTitle": "Smart Campus Navigation",
    "selectedTitleIndex": 1,
    "advisorId": "advisor-user-id"
  }
}
```

Notes:

- Backend no longer uses creator fallback for advisor assignment during project creation.
- Project title always comes from reviewer-selected proposal title.

## 7) Frontend UI recommendations

### Student (Group Leader)

- Draft form with exactly 3 title inputs.
- Disable submit until all 3 titles are valid and unique.
- On rejection, show `feedback` and allow resubmit of same proposal.

### Reviewer

- Show all 3 candidate titles in review panel.
- On approve, require selecting one title and advisor before enabling action button.
- On reject, require feedback text.

### Coordinator / Department Head (project creation action)

- Enable "Create Project" button only when status is `APPROVED`.
- If create fails with strict-contract errors, show a blocking alert and refresh proposal details.
- Use `creationSummary.finalTitle` from response for success confirmation.

## 8) Error mapping

- `403` -> role/department access denied.
- `404` -> proposal not found.
- `409` -> invalid decision state (e.g., already approved/rejected, non-submitted review).
- `400` -> validation issues (missing advisorId, invalid approvedTitleIndex, missing feedback, invalid titles).
