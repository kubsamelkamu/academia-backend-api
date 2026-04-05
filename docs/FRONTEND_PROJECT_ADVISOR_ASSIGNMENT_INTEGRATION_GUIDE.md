# Frontend Project Advisor Assignment Integration Guide

This guide covers how to integrate project advisor assignment and reassignment from the frontend using the backend endpoint:

- `PUT /api/v1/projects/:id/advisor`

Use this endpoint for an already created project. In the new approval flow, approved proposals should create a project immediately, even when no advisor is selected yet.

## Base

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <token>`

## 1) Purpose of the endpoint

This endpoint assigns or reassigns the advisor for an existing project.

Meaning of the URL:

- `:id` in `PUT /projects/:id/advisor` is the `project.id`

Request body:

```json
{
  "advisorId": "advisor-user-id"
}
```

Important ID mapping:

- Path `:id` = `project.id`
- Body `advisorId` = advisor `userId`
- Body `advisorId` is **not** the advisor profile id

Example using advisor list response:

```json
{
  "id": "advisor-profile-id",
  "userId": "advisor-user-id",
  "user": {
    "id": "advisor-user-id",
    "firstName": "Alem",
    "lastName": "Bekele",
    "avatarUrl": "https://..."
  }
}
```

In that case:

- use `advisor-profile-id` only for advisor-profile routes such as workload or summary
- use `advisor-user-id` for `PUT /projects/:id/advisor`

## 2) Who can call it

Allowed roles:

- `COORDINATOR`
- `DEPARTMENT_HEAD`

If the logged-in user does not have permission, backend returns `403`.

## 3) When frontend should use it

Use this endpoint when:

- a project already exists
- the frontend wants to assign the first advisor to the project
- the frontend wants to replace the currently assigned advisor with another advisor

Do not use this endpoint when the item is still a proposal and no project has been created yet.

Coordinator decision tree:

- if `proposal.project?.id` exists and `proposal.project.advisorId` is `null` -> use `PUT /projects/:projectId/advisor`
- if `proposal.project?.id` exists and `proposal.project.advisorId` exists -> use `PUT /projects/:projectId/advisor` for reassignment
- if a legacy approved proposal still has `project = null`, treat it as pre-migration data and use staff fallback tools only if necessary

With the new flow, approved proposals should normally have a real `project.id` immediately after approval.

## 4) How to get the required IDs

### Project ID

The path parameter is the project id:

```http
PUT /api/v1/projects/{projectId}/advisor
```

Frontend should get `projectId` from a project list, project details page, or directly from the approval response / proposal payload after approval.

### Advisor ID for the request body

Get advisors from:

- `GET /api/v1/projects/advisors?departmentId=<department-id>`

Use this field from the advisor list response:

- `userId`

Do not send:

- advisor profile `id`

Correct body:

```json
{
  "advisorId": "4fed2707-11a3-4a51-b9f1-d69a91c02866"
}
```

Wrong body:

```json
{
  "advisorId": "42f696ba-6956-478b-9388-16b367d5c172"
}
```

The wrong example uses the advisor profile id instead of the advisor user id.

## 5) Request example

```http
PUT /api/v1/projects/7f2b0f6a-2c2f-4d9e-9f4d-123456789abc/advisor
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "advisorId": "4fed2707-11a3-4a51-b9f1-d69a91c02866"
}
```

## 6) What backend does on success

When the request succeeds, backend:

- updates `project.advisorId`
- creates or updates the advisor's project membership with role `ADVISOR`
- if a previous advisor existed and is different, downgrades that previous advisor membership role
- sends notifications and assignment emails in the background

This means reassignment is handled as a real replacement, not just a display change.

## 7) Response behavior

The success response returns the updated project record.

Important frontend note:

- the immediate update response is not a full project-details payload optimized for UI rendering
- after success, the safest pattern is to refetch project details or the project list

Recommended frontend behavior after success:

1. show a success toast
2. close the advisor selection modal
3. refetch the current project details
4. update any advisor chip, card, or workload display using the refreshed data

## 8) Recommended frontend flow

1. Load the proposal or project card state and read `project.id`.
2. For newly approved proposals, expect `project.id` to exist immediately after approval.
3. Fetch advisor options with `GET /projects/advisors?departmentId=<departmentId>`.
4. Render advisor dropdown or modal using:
   - `advisor.user.firstName`
   - `advisor.user.lastName`
   - `advisor.user.email`
   - `advisor.user.avatarUrl`
   - optional `currentLoad`
5. When user selects an advisor for the project, submit:

```json
{
  "advisorId": "selectedAdvisor.userId"
}
```

6. On success, refetch project details.

## 9) Frontend request examples

### Fetch example

```ts
export async function assignProjectAdvisor(params: {
  projectId: string;
  advisorUserId: string;
  token: string;
}) {
  const response = await fetch(`/api/v1/projects/${params.projectId}/advisor`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      advisorId: params.advisorUserId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw error ?? new Error('Failed to assign advisor');
  }

  return response.json();
}
```

### Axios example

```ts
export async function assignProjectAdvisor(projectId: string, advisorUserId: string) {
  const { data } = await api.put(`/projects/${projectId}/advisor`, {
    advisorId: advisorUserId,
  });

  return data;
}
```

## 10) Suggested frontend types

```ts
export interface AdvisorListItem {
  id: string;
  userId: string;
  departmentId: string;
  loadLimit: number;
  currentLoad?: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface AssignProjectAdvisorPayload {
  advisorId: string;
}
```

## 11) Error mapping

- `403` -> user is not allowed to assign or reassign advisor
- `404` -> project not found

Practical frontend rule:

- if assignment fails, keep the current advisor UI state unchanged and show the backend message

## 12) Advisor milestone review queue

After an advisor is assigned, the frontend can load milestones currently waiting for advisor review.

Endpoints:

- `GET /api/v1/projects/advisors/me/milestone-review-queue`
- `GET /api/v1/projects/advisors/:id/milestone-review-queue`

Who should use which endpoint:

- advisor dashboard: use `GET /projects/advisors/me/milestone-review-queue`
- department staff dashboard for a specific advisor: use `GET /projects/advisors/:advisorProfileId/milestone-review-queue`

Response shape summary:

- `project`: active project info
- `group`: project group info and members
- `milestone`: submitted milestone seq waiting for review
- `latestSubmission`: latest uploaded submission file
- `review.feedbackCount`: number of advisor feedback entries on the latest submission
- `review.latestFeedback`: latest feedback item, including optional attachment metadata

Example response item:

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
    "status": "APPROVED",
    "leader": {
      "id": "student-1",
      "firstName": "Sara",
      "lastName": "Ali"
    },
    "members": [
      {
        "id": "student-1",
        "firstName": "Sara",
        "lastName": "Ali"
      },
      {
        "id": "student-2",
        "firstName": "Meron",
        "lastName": "Tadesse"
      }
    ]
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

Recommended UI behavior:

1. Show one card or table row per submitted milestone.
2. Use `milestone.status === 'SUBMITTED'` as the review-needed state.
3. Open `latestSubmission.fileUrl` when advisor wants to inspect the student file.
4. Show `review.latestFeedback` if review already started.
5. After advisor posts feedback or approves, refetch the queue.

## 13) Advisor feedback with attachment

Advisors can now add milestone feedback with an optional attached file.

Endpoint:

- `POST /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

Request type:

- `multipart/form-data`

Fields:

- `message`: required string
- `file`: optional file, allowed types `PDF` and `DOCX`

Frontend example using `FormData`:

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

To show feedback history for one submission:

- `GET /api/v1/projects/milestones/:milestoneId/submissions/:submissionId/feedbacks`

Each feedback item can contain:

- `message`
- `author`
- `authorRole`
- `createdAt`
- optional attachment metadata and `attachmentUrl`

## 14) Enriched student group proposals response

Student group proposal listing now includes project milestone review state.

Endpoint:

- `GET /api/v1/projects/proposals/group`

If a proposal already has a linked `project`, each milestone now includes:

- milestone seq title, due date, status, and submitted timestamp
- latest submission file info
- approved-by and approved-at info on the latest submission when available
- advisor feedback history for the latest submission
- attachment URLs from advisor review files

Frontend usage guidance:

1. Render milestones under each proposal’s linked project card.
2. Use latest submission info to show the last uploaded student version.
3. Render feedback timeline from `project.milestones[n].submissions[0].feedbacks`.
4. Show a download/view action when `attachmentUrl` exists.
5. When students resubmit after feedback, refresh the group proposals query after upload succeeds.

Practical UI rule:

- if a milestone has feedback attachment URLs, show them as advisor review files, separate from the student’s own submission file
- when a milestone is approved, expect a student notification with event type `MILESTONE_APPROVED` so the frontend can refresh milestone progress and unlock the next seq when your screen relies on notification-driven updates

- only allow advisor selection from the backend advisor list endpoint instead of typing ids manually
- this avoids sending the wrong id type or an invalid advisor reference

## 12) Summary for the frontend team

Use `PUT /api/v1/projects/:projectId/advisor` to assign or replace an advisor for an existing project. The path param is the project id. The body must send the advisor `userId`, not the advisor profile id. After approval, the frontend should normally already have a real `projectId`. Get advisor options from `GET /api/v1/projects/advisors?departmentId=...`, then submit `{ advisorId: selectedAdvisor.userId }`, and refetch project details after success.