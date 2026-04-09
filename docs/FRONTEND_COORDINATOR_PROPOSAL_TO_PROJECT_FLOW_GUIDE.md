# Frontend Coordinator Proposal-to-Project Flow Guide

This guide explains how the frontend should work with the new backend behavior where:

- approving a proposal automatically creates a real project
- a project can exist without an assigned advisor
- the advisor can be assigned later using the project advisor endpoint

This guide is intended for coordinator and department head frontend flows.

## Goal

The frontend should no longer treat approved proposals as a special "not yet a project" state for newly approved records.

New backend behavior:

1. Proposal is approved
2. Backend creates a project immediately
3. The created project may have `advisorId = null`
4. Frontend later assigns advisor using the real `projectId`

## Base

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <token>`
- Roles: `COORDINATOR`, `DEPARTMENT_HEAD`

## Core frontend rule

For newly approved proposals, expect a real project to exist immediately.

That means the frontend should now treat approval like this:

- approve proposal
- read `project.id` from the approval response
- if `project.advisorId` is `null`, show `Assign Advisor`
- if `project.advisorId` exists, show `Reassign Advisor`

## Endpoints used by frontend

### 1) List advisors in the department

- `GET /projects/advisors?departmentId=<departmentId>`

Use this to populate the advisor selector.

Important ID mapping:

- `advisor.id` = advisor profile id
- `advisor.userId` = advisor user id

When sending advisor assignment requests, always use:

- `advisor.userId`

### 2) List proposals in the department

- `GET /projects/proposals?departmentId=<departmentId>`

This now returns proposal items that may include:

```json
{
  "id": "proposal-id",
  "status": "APPROVED",
  "advisorId": null,
  "project": {
    "id": "project-id",
    "status": "ACTIVE",
    "advisorId": null
  }
}
```

For newly approved proposals after this deployment, `project` should normally exist.

### 3) Approve proposal

- `PUT /projects/proposals/:id/status`

Request body:

```json
{
  "status": "APPROVED",
  "approvedTitleIndex": 1
}
```

Advisor is optional during approval.

Optional approval with advisor:

```json
{
  "status": "APPROVED",
  "approvedTitleIndex": 1,
  "advisorId": "advisor-user-id"
}
```

Expected approval response now includes:

```json
{
  "id": "proposal-id",
  "status": "APPROVED",
  "advisorId": null,
  "project": {
    "id": "project-id",
    "status": "ACTIVE",
    "advisorId": null
  },
  "transitionSummary": {
    "proposalId": "proposal-id",
    "projectId": "project-id",
    "advisorId": null,
    "action": "PROPOSAL_APPROVED_AND_PROJECT_CREATED"
  }
}
```

### 4) Assign or reassign advisor on a project

- `PUT /projects/:projectId/advisor`

Request body:

```json
{
  "advisorId": "advisor-user-id"
}
```

Use this endpoint when:

- the project already exists and has no advisor yet
- the project already exists and you want to replace the advisor

## Frontend state model

The frontend should reason about proposal cards and project cards using these states.

### State A: Submitted proposal

```json
{
  "status": "SUBMITTED",
  "project": null,
  "advisorId": null
}
```

UI actions:

- show `Approve`
- show `Reject`

### State B: Approved proposal with created project and no advisor

```json
{
  "status": "APPROVED",
  "project": {
    "id": "project-id",
    "status": "ACTIVE",
    "advisorId": null
  }
}
```

UI actions:

- show `Assign Advisor`

API to call:

- `PUT /projects/:projectId/advisor`

### State C: Approved proposal with created project and assigned advisor

```json
{
  "status": "APPROVED",
  "project": {
    "id": "project-id",
    "status": "ACTIVE",
    "advisorId": "advisor-user-id"
  }
}
```

UI actions:

- show `Reassign Advisor`

API to call:

- `PUT /projects/:projectId/advisor`

### State D: Legacy approved proposal with no project

```json
{
  "status": "APPROVED",
  "project": null
}
```

This should be treated as legacy data created before the new flow was deployed.

Recommended UI handling:

- show a `Legacy item` or `Needs refresh/manual action` badge
- avoid using title matching to infer project ids
- refetch after actions if backend cleanup scripts or manual migration are used

## Recommended coordinator UI logic

### On proposal list page

For each item:

1. If `status !== 'APPROVED'`, use normal review actions.
2. If `status === 'APPROVED'` and `project?.id` exists:
   - if `project.advisorId` is `null`, render `Assign Advisor`
   - else render `Reassign Advisor`
3. If `status === 'APPROVED'` and `project` is `null`:
   - treat as legacy data
   - do not try to map project using title or group name

## Recommended API flow after approval

### Flow 1: Approve without advisor

1. User clicks approve.
2. Frontend sends:

```json
{
  "status": "APPROVED",
  "approvedTitleIndex": 0
}
```

3. Backend returns approved proposal plus created project.
4. Frontend reads `response.project.id`.
5. Frontend shows `Assign Advisor` action.

### Flow 2: Approve with advisor

1. User selects advisor before approval.
2. Frontend sends:

```json
{
  "status": "APPROVED",
  "approvedTitleIndex": 0,
  "advisorId": "advisor-user-id"
}
```

3. Backend returns approved proposal plus created project.
4. Frontend reads `response.project.id`.
5. Project already has advisor; UI can show assigned advisor immediately.

### Flow 3: Assign advisor later

1. User opens advisor modal from an approved project-backed card.
2. Frontend loads advisor list from:
   - `GET /projects/advisors?departmentId=<departmentId>`
3. User picks advisor.
4. Frontend sends:

```json
{
  "advisorId": "selectedAdvisor.userId"
}
```

5. Frontend refetches proposal list or project details.

## Frontend pseudocode

```ts
type ProposalCardAction =
  | 'approve'
  | 'reject'
  | 'assign-advisor'
  | 'reassign-advisor'
  | 'legacy-approved-no-project';

export function resolveCoordinatorCardAction(item: {
  status: string;
  advisorId?: string | null;
  project?: {
    id: string;
    status: string;
    advisorId?: string | null;
  } | null;
}): ProposalCardAction[] {
  if (item.status === 'SUBMITTED') {
    return ['approve', 'reject'];
  }

  if (item.status === 'APPROVED') {
    if (!item.project?.id) {
      return ['legacy-approved-no-project'];
    }

    if (!item.project.advisorId) {
      return ['assign-advisor'];
    }

    return ['reassign-advisor'];
  }

  return [];
}
```

## Suggested TypeScript types

```ts
export interface CoordinatorProposalListItem {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  title: string;
  advisorId: string | null;
  project: {
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    advisorId: string | null;
  } | null;
  projectGroup: {
    id: string;
    name: string;
  } | null;
}

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
```

## Fetch examples

### Approve proposal

```ts
await api.put(`/projects/proposals/${proposalId}/status`, {
  status: 'APPROVED',
  approvedTitleIndex,
});
```

### Assign advisor later

```ts
await api.put(`/projects/${projectId}/advisor`, {
  advisorId: selectedAdvisor.userId,
});
```

## Frontend do and do not

Do:

- use `response.project.id` after approval when available
- use `proposal.project.id` from proposal list items
- use `advisor.userId` in assignment request bodies
- refetch data after approval or advisor assignment

Do not:

- use advisor profile `id` in `advisorId` request bodies
- use proposal `id` in `PUT /projects/:id/advisor`
- infer project ids by matching titles or group names

## Acceptance criteria for frontend

Frontend integration is correct when:

1. Approving a proposal creates a real project immediately.
2. The approval response exposes `project.id`.
3. Approved cards use real `project.id` for later advisor assignment.
4. Advisor assignment always uses `advisor.userId`.
5. The UI no longer depends on title-based or group-name-based project matching.