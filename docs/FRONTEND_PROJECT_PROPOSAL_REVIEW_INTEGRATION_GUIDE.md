# Frontend Project Proposal Review Integration Guide

This guide covers the proposal flow where a Group Leader submits exactly **3 candidate project titles**, and Coordinator/Department Head approves or rejects.

If your frontend uses **Option B (upload-first / start from upload)**, use:

- `docs/FRONTEND_PROJECT_PROPOSAL_UPLOAD_FIRST_INTEGRATION_GUIDE.md`

If you need the rejected-proposal reminder workflow after a rejection decision, use:

- `docs/FRONTEND_PROJECT_PROPOSAL_REJECTION_REMINDER_INTEGRATION_GUIDE.md`

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
- Only **one** proposal can be `SUBMITTED` at a time per project group. If the group already has another `SUBMITTED` proposal, this returns `409`.
- Sends `PROPOSAL_SUBMITTED` notifications to Coordinator and Department Head in same department.
- Can send informational email to Coordinator and Department Head if `BREVO_PROPOSAL_SUBMITTED_TEMPLATE_ID` is configured.

## 4) List my group proposals (All group members)

- `GET /projects/proposals/group`

Use this endpoint when you want **every approved project group member** to see the group’s proposals.

## 4.1) List proposals in a department (Coordinator / Department Head)

- `GET /projects/proposals?departmentId=<departmentId>`

Notes:

- Supports optional filters: `status`, `startDate`, `endDate`.
- Response now returns both `summary` counts and `items`.
- `summary.pending` maps to proposals in `SUBMITTED` status.
- `summary.total` uses the department plus date filter window, and is not reduced by the optional `status` filter.
- Response includes `projectGroup` (when available) with:
  - `leader` user details: `id`, `firstName`, `lastName`, `email`, `avatarUrl`
  - `members[]` user details: `id`, `firstName`, `lastName`, `email`, `avatarUrl`
- Response includes `project` when the approved proposal has already been converted into a real project.
- Frontend should branch on `item.project` instead of matching by title or group name.

Example response body inside the standard API envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "summary": {
      "total": 24,
      "pending": 5,
      "approved": 2,
      "rejected": 1,
      "draft": 16
    },
    "items": [
      {
        "id": "proposal-id",
        "status": "APPROVED",
        "advisorId": null,
        "title": "Smart Campus Navigation",
        "projectGroup": {
          "id": "group-id",
          "name": "Team Alpha"
        },
        "project": null
      },
      {
        "id": "proposal-id-2",
        "status": "APPROVED",
        "advisorId": "advisor-user-id",
        "title": "Adaptive Learning Assistant",
        "projectGroup": {
          "id": "group-id-2",
          "name": "Team Beta"
        },
        "project": {
          "id": "project-id",
          "status": "ACTIVE",
          "advisorId": "advisor-user-id"
        }
      }
    ]
  },
  "timestamp": "2026-04-03T18:42:02.693Z"
}
```

Coordinator decision rule for each approved proposal card:

- `project` exists -> use `PUT /projects/:projectId/advisor`
- `project` is `null` and `advisorId` is empty -> use `PUT /projects/proposals/:proposalId/advisor`
- `project` is `null` and `advisorId` exists -> use `POST /projects` with `proposalId`

## 4.2) Get proposal details

- `GET /projects/proposals/:id`

Notes:

- Response includes `projectGroup` (when available) with `leader` + `members[]` user details:
  - `id`, `firstName`, `lastName`, `email`, `avatarUrl`

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
- `advisorId` is optional. If provided, it must belong to the same tenant + department.
- `approvedTitleIndex` is required and must be `0`, `1`, or `2`.
- Backend sets final `title` from the selected index and stores `selectedTitleIndex`.
- If email templates are configured, approval/rejection also trigger informational emails for the proposal group.

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
- After rejection, Coordinator/Department Head can create one active resubmission reminder with a countdown deadline for the proposal group.

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
- If `BREVO_PROPOSAL_FEEDBACK_ADDED_TEMPLATE_ID` is configured, backend also sends an informational feedback email to proposal group members.

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
- `PROPOSAL_RESUBMISSION_REMINDER_CREATED` (to proposal group)
- `PROPOSAL_RESUBMISSION_REMINDER_24H` (to proposal group)
- `PROPOSAL_RESUBMISSION_REMINDER_1H` (to proposal group)
- `PROPOSAL_RESUBMISSION_REMINDER_DEADLINE_PASSED` (to proposal group)
- Optional email templates mirror these events and remain informational-only (no action buttons).

## 6.1) Rejected proposal reminder flow

- `POST /projects/proposals/:id/rejection-reminder`
- Roles: `COORDINATOR`, `DEPARTMENT_HEAD`

Request body:

```json
{
  "title": "Proposal Resubmission Reminder",
  "message": "Please revise the scope and references before resubmitting.",
  "deadlineAt": "2026-04-10T12:00:00.000Z",
  "disableAfterDeadline": true
}
```

Behavior:

- Allowed only when the proposal is already `REJECTED`.
- Creates a high-priority project-group announcement with `kind = PROPOSAL_REJECTION_REMINDER`.
- Reminder appears in `GET /project-groups/me/announcements` for approved group members.
- Reminder response includes countdown-ready fields: `deadlineAt`, `isExpired`, `isDisabled`, `secondsRemaining`.
- Backend sends informational reminder emails at 24h, 1h, and deadline-passed milestones if the corresponding Brevo template IDs are configured.

## 6.2) Student group advisor details

Use this endpoint when any approved student in the group needs the assigned advisor profile with contact and avatar details.

- `GET /project-groups/me/advisor`
- Roles: `STUDENT`

Behavior:

- Resolves the advisor for the authenticated student's group.
- Prefers the current project advisor if a project has already been created.
- Falls back to the advisor assigned on the most relevant proposal when project creation has not happened yet.

Response shape:

```json
{
  "group": {
    "id": "group-id",
    "name": "Team Alpha",
    "status": "APPROVED"
  },
  "source": {
    "type": "PROJECT",
    "proposalId": "proposal-id",
    "proposalTitle": "Smart Campus Navigation",
    "projectId": "project-id",
    "projectTitle": "Smart Campus Navigation"
  },
  "advisor": {
    "id": "advisor-user-id",
    "firstName": "Alem",
    "lastName": "Bekele",
    "fullName": "Alem Bekele",
    "email": "alem@example.com",
    "avatarUrl": "https://..."
  }
}
```

Error mapping:

- `400` -> no advisor is assigned yet for the student's group
- `403` -> user is not a student or cannot access the group context

## 6.3) Advisor summary endpoint

Use this endpoint when the frontend needs a professional summary view for an advisor, including advised groups, advised projects, total students advised, and project start dates.

## 6.2.1) Advisor list endpoint for assignment UI

Use this endpoint to populate advisor dropdowns for proposal approval or later advisor assignment.

- `GET /projects/advisors?departmentId=<department-id>`
- Optional query: `includeLoad=true`

Response item shape:

```json
{
  "id": "advisor-profile-id",
  "userId": "advisor-user-id",
  "departmentId": "department-id",
  "loadLimit": 5,
  "currentLoad": 0,
  "createdAt": "2026-03-27T20:24:50.088Z",
  "updatedAt": "2026-03-27T20:24:50.088Z",
  "user": {
    "id": "advisor-user-id",
    "firstName": "Alem",
    "lastName": "Bekele",
    "email": "alem@example.com",
    "avatarUrl": "https://..."
  }
}
```

Frontend notes:

- Use `user.id` when an API expects the advisor user id, such as `advisorId` in proposal approval or later assignment.
- Use `id` only when an API explicitly asks for the advisor profile id.
- `user.avatarUrl` may be `null`; render initials fallback when missing.

- `GET /projects/advisors/:id/summary`

Access rules:

- `ADVISOR` can fetch their own summary
- `COORDINATOR` and `DEPARTMENT_HEAD` can fetch summaries for advisors in their department

Response shape:

```json
{
  "advisor": {
    "id": "advisor-user-id",
    "advisorProfileId": "advisor-profile-id",
    "firstName": "Alem",
    "lastName": "Bekele",
    "fullName": "Alem Bekele",
    "email": "alem@example.com",
    "avatarUrl": "https://..."
  },
  "metrics": {
    "totalProjectsAdvising": 3,
    "totalGroupsAdvising": 3,
    "totalStudentsAdvising": 11,
    "totalGroupsSupervising": 4,
    "totalStudentsSupervising": 14,
    "projectStatusCounts": {
      "ACTIVE": 3,
      "COMPLETED": 1,
      "CANCELLED": 0
    },
    "totalProjectsAssigned": 4
  },
  "projects": [
    {
      "id": "project-id",
      "title": "Smart Campus Navigation",
      "status": "ACTIVE",
      "startedAt": "2026-03-20T09:00:00.000Z",
      "proposal": {
        "id": "proposal-id",
        "title": "Smart Campus Navigation"
      },
      "group": {
        "id": "group-id",
        "name": "Team Alpha",
        "status": "APPROVED",
        "leader": {
          "id": "student-id",
          "firstName": "Sara",
          "lastName": "Ali",
          "email": "sara@example.com",
          "avatarUrl": "https://..."
        },
        "members": [
          {
            "id": "student-id-2",
            "firstName": "Abel",
            "lastName": "Kassa",
            "email": "abel@example.com",
            "avatarUrl": "https://..."
          }
        ],
        "studentCount": 4
      }
    }
  ]
}
```

## 6.4) Advisor assigned projects (detailed + progress)

Use this endpoint when the frontend needs a **project list view** for an advisor, including project title/status, project group members, start date, and a milestone-based progress indicator.

- `GET /projects/advisors/:id/projects`

Access rules:

- `ADVISOR` can fetch their own assigned projects
- `COORDINATOR` and `DEPARTMENT_HEAD` can fetch assigned projects for advisors in their department

Response shape:

```json
[
  {
    "id": "project-id",
    "title": "Smart Campus Navigation",
    "status": "ACTIVE",
    "startedAt": "2026-03-23T10:00:00.000Z",
    "group": {
      "id": "group-id",
      "name": "Team Alpha",
      "status": "APPROVED",
      "leader": { "id": "...", "firstName": "...", "lastName": "...", "email": "...", "avatarUrl": "..." },
      "members": [
        { "id": "...", "firstName": "...", "lastName": "...", "email": "...", "avatarUrl": "..." }
      ],
      "studentCount": 4
    },
    "milestones": {
      "total": 5,
      "completed": 2,
      "approved": 2,
      "pending": 2,
      "submitted": 1,
      "rejected": 0,
      "progressPercent": 40
    }
  }
]
```

Notes:

- `milestones.completed` currently equals the number of milestones in `APPROVED` status.
- `progressPercent` is computed as `floor((approved / total) * 100)`.

Notes:

- `totalStudentsAdvising` is counted as unique student users across the advisor's current assigned projects.
- `startedAt` currently maps to the project `createdAt` timestamp.

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
- Proposal must already have an assigned advisor before project creation.
- If configured, backend sends informational emails for `PROJECT_CREATED` after successful project creation and `PROJECT_ADVISOR_ASSIGNED` when advisor assignment/reassignment happens.
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
- On approve, require selecting one title before enabling action button.
- Advisor selection during approval is optional if your flow supports assigning the advisor after approval.
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
