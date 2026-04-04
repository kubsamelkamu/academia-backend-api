# Frontend Project Advisor Assignment Integration Guide

This guide covers how to integrate project advisor assignment and reassignment from the frontend using the backend endpoint:

- `PUT /api/v1/projects/:id/advisor`

Use this endpoint only for an already created project. If the frontend is still working with a proposal that has not yet become a project, use the proposal review endpoints instead.

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

- if `proposal.project?.id` exists -> use `PUT /projects/:projectId/advisor`
- if `proposal.project` is `null` and `proposal.advisorId` is empty -> use `PUT /projects/proposals/:proposalId/advisor`
- if `proposal.project` is `null` and `proposal.advisorId` exists -> use `POST /projects` with `{ proposalId }`

This distinction matters because an approved proposal is not always a real project yet.

## 4) How to get the required IDs

### Project ID

The path parameter is the project id:

```http
PUT /api/v1/projects/{projectId}/advisor
```

Frontend should get `projectId` from a project list, project details page, or from the project returned after proposal approval and conversion.

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

1. Load the proposal or project card state and check whether a real `project.id` exists.
2. If `project.id` exists, use the project advisor flow in this guide.
3. If no project exists yet, do not call `PUT /projects/:id/advisor`; use the proposal-specific action instead.
4. Fetch advisor options with `GET /projects/advisors?departmentId=<departmentId>`.
5. Render advisor dropdown or modal using:
   - `advisor.user.firstName`
   - `advisor.user.lastName`
   - `advisor.user.email`
   - `advisor.user.avatarUrl`
   - optional `currentLoad`
6. When user selects an advisor for a real project, submit:

```json
{
  "advisorId": "selectedAdvisor.userId"
}
```

7. On success, refetch project details.

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

- only allow advisor selection from the backend advisor list endpoint instead of typing ids manually
- this avoids sending the wrong id type or an invalid advisor reference

## 12) Summary for the frontend team

Use `PUT /api/v1/projects/:projectId/advisor` to assign or replace an advisor for an existing project. The path param is the project id. The body must send the advisor `userId`, not the advisor profile id. Get advisor options from `GET /api/v1/projects/advisors?departmentId=...`, then submit `{ advisorId: selectedAdvisor.userId }`, and refetch project details after success.