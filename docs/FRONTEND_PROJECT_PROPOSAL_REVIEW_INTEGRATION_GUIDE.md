# Frontend Project Proposal Review Integration Guide

This guide covers the proposal flow where a Group Leader submits exactly **3 candidate project titles**, and Coordinator/Department Head approves or rejects.

If your frontend uses **Option B (upload-first / start from upload)**, use:

- `docs/FRONTEND_PROJECT_PROPOSAL_UPLOAD_FIRST_INTEGRATION_GUIDE.md`

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
- `description` is optional (if provided, must be non-empty).

Behavior:

- Backend stores all candidate titles in `proposedTitles`.
- Backend sets `title` to the first candidate as default placeholder before approval.
- Initial status is `DRAFT`.

- Initial status is `DRAFT`.

### Alternative: start the process from upload (create draft + upload PDF in one request)

If you want to avoid creating a draft ID first, use:

- `POST /projects/proposals/with-proposal-pdf`
- Content type: `multipart/form-data`
- Form fields:
  - `titles` (send 3 times) OR `titles` as a JSON array string
  - `description` (string)
  - `proposalPdf` (file, PDF-only, max 5MB)

Example (recommended: send 3 titles as repeated fields):

```ts
const form = new FormData();
form.append('titles', title1);
form.append('titles', title2);
form.append('titles', title3);
form.append('description', description);
form.append('proposalPdf', file);

await fetch('/api/v1/projects/proposals/with-proposal-pdf', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});
```

Notes:

- Backend creates the proposal draft (`DRAFT`) and stores the PDF as `proposal.documents[0]` with `key = "proposal.pdf"`.
- If the PDF upload fails, backend rolls back the created draft.

## 2) Upload proposal PDF (Student Group Leader) — REQUIRED before submit

- `POST /projects/proposals/:id/proposal-pdf`
- Content type: `multipart/form-data`
- Form field name: `proposalPdf`
- Constraints:
  - PDF only (`application/pdf`)
  - Max size: **5MB**
  - Exactly one file (upload replaces the previous one)

Example (browser / frontend):

```ts
const form = new FormData();
form.append('proposalPdf', file); // file must be a PDF

await fetch(`/api/v1/projects/proposals/${proposalId}/proposal-pdf`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});
```

Behavior:

- Allowed when proposal status is `DRAFT` or `REJECTED`.
- Not allowed when `SUBMITTED` or `APPROVED`.
- Stores the uploaded file metadata in `proposal.documents` with `key = "proposal.pdf"`.

## 3) Submit proposal for review (Student Group Leader)

- `POST /projects/proposals/:id/submit`

Behavior:

- Allowed from `DRAFT` or `REJECTED`.
- Moves status to `SUBMITTED`.
- Requires `proposal.pdf` to be uploaded first (otherwise `400`).
- Sends `PROPOSAL_SUBMITTED` notifications to Coordinator and Department Head in same department.

## 4) List my proposals (Student Group Leader)

- `GET /projects/proposals/me`

Use this endpoint for student dashboard list/history.

## 5) Reviewer decision (Coordinator / Department Head)

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

## 5.1) Reviewer feedback timeline (multiple comments) (Advisor / Department Head / Coordinator)

Use this when you want a **comment history** (thread) on a submitted proposal before the final decision.

### Add a feedback comment

- `POST /projects/proposals/:id/feedbacks`

Request body:

```json
{
  "message": "Please clarify the scope and add more recent citations."
}
```

Rules:

- Allowed roles: `Advisor`, `DepartmentHead`, `Coordinator`
- Proposal must be in `SUBMITTED`

### List feedback comments

- `GET /projects/proposals/:id/feedbacks`

Access rules:

- Student can read feedback only for their own proposal.
- Faculty/admin users can read if they have department access.
```

## 6) Notifications used in this flow

- `PROPOSAL_SUBMITTED` (to Coordinator + Department Head)
- `PROPOSAL_APPROVED` (to submitter/group)
- `PROPOSAL_REJECTED` (to submitter/group)

## 7) Create project from approved proposal (Step 3)

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

## 8) Frontend UI recommendations

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

## 9) Error mapping

- `403` -> role/department access denied.
- `404` -> proposal not found.
- `409` -> invalid decision state (e.g., already approved/rejected, non-submitted review).
- `400` -> validation issues (missing advisorId, invalid approvedTitleIndex, missing feedback, invalid titles).
