# Frontend Coordinator Project Evaluation Aggregation Integration Guide

This guide explains how to integrate these coordinator endpoints from your frontend:

- `GET /api/v1/project-evaluations/coordinator/dashboard`
- `GET /api/v1/project-evaluations/coordinator/projects/{projectId}`
- `POST /api/v1/project-evaluations/coordinator/projects/{projectId}/preview`
- `POST /api/v1/project-evaluations/coordinator/projects/{projectId}/finalize`

The goal is clear frontend integration for the coordinator aggregation flow, including response shapes, request bodies, status handling, and common error cases.

## Scope

This guide is for the coordinator final-grade aggregation flow for:

- `CAPSTONE_I`
- logged-in coordinator user
- coordinator assigned to a department
- active projects inside that department

Important:

- These endpoints require a valid coordinator JWT access token.
- Only `CAPSTONE_I` is currently supported.
- Final grade calculation depends on department weights.
- Preview and finalize only work after advisor submission and all evaluator submissions are complete.
- Finalize stores the final grade snapshot and sends the project to department-head review.

## One Important Prerequisite

Before preview and finalize can work, the department must already have grading weights configured.

That is done through:

- `GET /api/v1/project-evaluations/coordinator/weights?stage=CAPSTONE_I`
- `PUT /api/v1/project-evaluations/coordinator/weights`

The four endpoints in this guide expose whether weights are configured, but your frontend should expect `WAITING_FOR_WEIGHTS` states until weights are saved.

## Recommended Stepwise Frontend Flow

### Step 1: Load coordinator dashboard

Use:

- `GET /api/v1/project-evaluations/coordinator/dashboard?stage=CAPSTONE_I`

Use the dashboard to:

- render project cards or rows
- show current aggregation state
- show whether weights are configured
- decide which CTA to show for each project

### Step 2: Open one project detail page

Use:

- `GET /api/v1/project-evaluations/coordinator/projects/{projectId}?stage=CAPSTONE_I`

Use the detail response to:

- render group members
- display advisor scores/comments
- display evaluator scores/comments
- know whether final preview is allowed

### Step 3: Generate preview before finalization

Use:

- `POST /api/v1/project-evaluations/coordinator/projects/{projectId}/preview?stage=CAPSTONE_I`

Use preview to:

- show final computed grade per student
- show letter grade per student
- show weighted breakdown
- allow coordinator to review before final submit

### Step 4: Finalize once the coordinator confirms

Use:

- `POST /api/v1/project-evaluations/coordinator/projects/{projectId}/finalize?stage=CAPSTONE_I`

This moves the project into department-head review.

## Common Status Values You Should Use in Frontend

### Aggregation Status

- `WAITING_FOR_WEIGHTS`
- `WAITING_FOR_ADVISOR`
- `WAITING_FOR_EVALUATORS`
- `READY_FOR_AGGREGATION`

### Finalization Status

- `NOT_FINALIZED`
- `FINALIZED_PENDING_DEPARTMENT_HEAD`
- `APPROVED`
- `REJECTED`

### Dashboard Next Action

- `CONFIGURE_WEIGHTS`
- `WAIT_FOR_ADVISOR_SUBMISSION`
- `WAIT_FOR_EVALUATOR_SUBMISSIONS`
- `OPEN_PREVIEW`
- `VIEW_FINALIZED_RESULT`
- `VIEW_APPROVED_RESULT`
- `REVIEW_REJECTED_RESULT`

## Endpoint 1: Coordinator Dashboard

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/coordinator/dashboard?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`

## Dashboard Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "weights": {
    "isConfigured": true,
    "advisorPercentage": 40,
    "evaluatorPercentage": 60,
    "updatedAt": "2026-04-16T10:15:00.000Z"
  },
  "summary": {
    "totalProjectGroups": 4,
    "waitingForWeightsCount": 0,
    "waitingForAdvisorCount": 1,
    "waitingForEvaluatorsCount": 1,
    "readyForAggregationCount": 1,
    "finalizedPendingApprovalCount": 1,
    "approvedCount": 0,
    "rejectedCount": 0
  },
  "projectGroups": [
    {
      "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
      "projectTitle": "AI Attendance Monitoring",
      "projectStatus": "ACTIVE",
      "group": {
        "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
        "name": "Group Alpha",
        "totalMembers": 3
      },
      "advisorEvaluation": {
        "status": "SUBMITTED",
        "submittedAt": "2026-04-16T09:00:00.000Z"
      },
      "evaluatorEvaluation": {
        "totalAssignedEvaluators": 2,
        "submittedEvaluators": 2,
        "pendingEvaluators": 0,
        "allSubmitted": true
      },
      "aggregationStatus": "READY_FOR_AGGREGATION",
      "finalizationStatus": "NOT_FINALIZED",
      "weights": {
        "advisorPercentage": 40,
        "evaluatorPercentage": 60
      },
      "finalizedBy": null,
      "finalizedAt": null,
      "approvedAt": null,
      "hasRejectionReason": false,
      "nextAction": "OPEN_PREVIEW"
    }
  ]
}
```

### How Frontend Should Use Dashboard Response

- build dashboard counters from `summary`
- show a department-wide weights banner from `weights`
- use `aggregationStatus` and `finalizationStatus` to color status pills
- use `nextAction` to decide which primary button appears in each row

Recommended mapping:

- `CONFIGURE_WEIGHTS` -> open weight settings UI
- `OPEN_PREVIEW` -> open detail page and preview CTA
- `VIEW_FINALIZED_RESULT` -> open detail page in review mode
- `VIEW_APPROVED_RESULT` -> open detail page in read-only approved mode
- `REVIEW_REJECTED_RESULT` -> open detail page and show rejection state

## Dashboard Common Error Cases

### 400: unsupported stage

```json
{
  "message": "Only CAPSTONE_I is supported for now",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 403: coordinator has no department

```json
{
  "message": "Coordinator is not assigned to a department",
  "error": "Forbidden",
  "statusCode": 403
}
```

### 404: coordinator user not found

```json
{
  "message": "Coordinator user not found",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 2: Coordinator Project Detail

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/coordinator/projects/{projectId}?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`

## Project Detail Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "AI Attendance Monitoring",
    "status": "ACTIVE",
    "createdAt": "2026-03-01T09:00:00.000Z"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Alpha",
    "status": "ACTIVE",
    "totalMembers": 3,
    "leader": {
      "userId": "d5d40de0-5726-4c94-b574-dcd53bd3f020",
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  },
  "weights": {
    "isConfigured": true,
    "advisorPercentage": 40,
    "evaluatorPercentage": 60,
    "updatedAt": "2026-04-16T10:15:00.000Z"
  },
  "advisorEvaluation": {
    "status": "SUBMITTED",
    "submittedAt": "2026-04-16T09:00:00.000Z",
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 0
  },
  "evaluatorEvaluation": {
    "totalAssignedEvaluators": 2,
    "submittedEvaluators": 2,
    "pendingEvaluators": 0,
    "allSubmitted": true,
    "evaluators": [
      {
        "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
        "fullName": "Dr Jane Smith",
        "status": "SUBMITTED",
        "submittedAt": "2026-04-16T08:40:00.000Z"
      }
    ]
  },
  "students": [
    {
      "studentUserId": "d5d40de0-5726-4c94-b574-dcd53bd3f020",
      "fullName": "John Doe",
      "email": "john@example.com",
      "advisorScore": {
        "score": 82,
        "comment": "Good project ownership and documentation.",
        "status": "EVALUATED"
      },
      "evaluatorScores": [
        {
          "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
          "evaluatorName": "Dr Jane Smith",
          "score": 84,
          "comment": "Clear explanation and solid implementation.",
          "status": "EVALUATED"
        },
        {
          "evaluatorUserId": "ee742918-cb79-4cc0-8393-b73ad9cc9a5f",
          "evaluatorName": "Dr Mike Paul",
          "score": 80,
          "comment": "Good work with minor presentation gaps.",
          "status": "EVALUATED"
        }
      ],
      "evaluatorAverageScore": 82,
      "isReadyForFinalCalculation": true
    }
  ],
  "aggregationStatus": "READY_FOR_AGGREGATION",
  "finalizationStatus": "NOT_FINALIZED",
  "readyForPreview": true
}
```

### How Frontend Should Use Detail Response

- render the full calculation source data from `students`
- show advisor and evaluator comments in the same view
- use `readyForPreview` to enable preview button
- if `finalizationStatus !== "NOT_FINALIZED"`, treat the page as a review state instead of an editable aggregation state

## Project Detail Common Error Cases

### 404: project not found for this coordinator

```json
{
  "message": "Project not found for this coordinator",
  "error": "Not Found",
  "statusCode": 404
}
```

### 400: project has no group

```json
{
  "message": "Project group not found for this project",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Endpoint 3: Preview Final Grades

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/coordinator/projects/{projectId}/preview?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`

### Request Body

No request body is required.

## Preview Success Response

Status code:

- `201 Created`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "AI Attendance Monitoring",
    "status": "ACTIVE"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Alpha",
    "totalMembers": 3
  },
  "weights": {
    "advisorPercentage": 40,
    "evaluatorPercentage": 60
  },
  "students": [
    {
      "studentUserId": "d5d40de0-5726-4c94-b574-dcd53bd3f020",
      "fullName": "John Doe",
      "email": "john@example.com",
      "advisorScore": {
        "score": 82,
        "comment": "Good project ownership and documentation."
      },
      "evaluatorScores": [
        {
          "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
          "evaluatorName": "Dr Jane Smith",
          "score": 84,
          "comment": "Clear explanation and solid implementation."
        },
        {
          "evaluatorUserId": "ee742918-cb79-4cc0-8393-b73ad9cc9a5f",
          "evaluatorName": "Dr Mike Paul",
          "score": 80,
          "comment": "Good work with minor presentation gaps."
        }
      ],
      "evaluatorAverageScore": 82,
      "finalGrade": 82,
      "letterGrade": "A-"
    }
  ],
  "roundedToDecimalPlaces": 2,
  "gradeScale": {
    "A+": { "min": 90, "max": 100 },
    "A": { "min": 85, "max": 89.99 },
    "A-": { "min": 80, "max": 84.99 },
    "B+": { "min": 75, "max": 79.99 },
    "B": { "min": 70, "max": 74.99 },
    "B-": { "min": 65, "max": 69.99 },
    "C+": { "min": 60, "max": 64.99 },
    "C": { "min": 50, "max": 59.99 },
    "C-": { "min": 45, "max": 49.99 },
    "D": { "min": 40, "max": 44.99 },
    "F": { "min": 0, "max": 39.99 }
  },
  "aggregationStatus": "READY_FOR_AGGREGATION",
  "readyToFinalize": true,
  "previewGeneratedAt": "2026-04-16T10:30:10.300Z"
}
```

### How Frontend Should Use Preview Response

- open a confirmation modal or preview screen
- show weighted score breakdown for each student
- show final grade and letter grade clearly
- use this response as the last review screen before finalization

Important:

- preview is computed from backend data, not frontend calculations
- your frontend should trust preview and avoid recalculating grades independently

## Preview Common Error Cases

### 400: weights missing

```json
{
  "message": "Grading weights are not configured for CAPSTONE_I in this department",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: advisor not submitted yet

```json
{
  "message": "Advisor evaluation must be submitted before previewing final grades",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: evaluator submissions incomplete

```json
{
  "message": "All assigned evaluator evaluations must be submitted before previewing final grades",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: already finalized

```json
{
  "message": "Final grade has already been finalized for this project and stage",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: already approved

```json
{
  "message": "Final grade has already been approved and cannot be previewed again",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: missing student scores

```json
{
  "message": "Some students are missing required scores for final preview",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Endpoint 4: Finalize Project Grades

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/coordinator/projects/{projectId}/finalize?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

### Request Body

`note` is optional.

```json
{
  "note": "Reviewed and ready for department-head approval."
}
```

### Body Rules

- `note` is optional
- `note` max length is `1000`

## Finalize Success Response

Status code:

- `201 Created`

Response:

```json
{
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "stage": "CAPSTONE_I",
  "status": "FINALIZED_PENDING_DEPARTMENT_HEAD",
  "weights": {
    "advisorPercentage": 40,
    "evaluatorPercentage": 60
  },
  "finalizedBy": {
    "userId": "95dfdb11-fb64-4939-8618-c7e321d05344",
    "fullName": "Coordinator Mary"
  },
  "finalizedAt": "2026-04-16T10:42:00.000Z",
  "note": "Reviewed and ready for department-head approval.",
  "students": [
    {
      "studentUserId": "d5d40de0-5726-4c94-b574-dcd53bd3f020",
      "fullName": "John Doe",
      "finalGrade": 82,
      "letterGrade": "A-"
    }
  ]
}
```

### How Frontend Should Use Finalize Response

- switch the project into read-only finalized state
- hide preview/finalize actions
- show a badge like `Pending Department Head Review`
- show finalized note and finalized timestamp
- optionally redirect back to dashboard and refresh counts

## Finalize Common Error Cases

### 400: weights missing

```json
{
  "message": "Grading weights are not configured for CAPSTONE_I in this department",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: advisor submission missing

```json
{
  "message": "Advisor evaluation must be submitted before finalization",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: evaluator submissions incomplete

```json
{
  "message": "All assigned evaluator evaluations must be submitted before finalization",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: already finalized pending department head

```json
{
  "message": "Final grade has already been finalized for this project and stage",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: already approved

```json
{
  "message": "Final grade has already been approved and cannot be re-finalized",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: missing student scores

```json
{
  "message": "Some students are missing required scores for finalization",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Minimal Frontend Types

```ts
export type EvaluationStage = 'CAPSTONE_I';

export type AggregationStatus =
  | 'WAITING_FOR_WEIGHTS'
  | 'WAITING_FOR_ADVISOR'
  | 'WAITING_FOR_EVALUATORS'
  | 'READY_FOR_AGGREGATION';

export type FinalizationStatus =
  | 'NOT_FINALIZED'
  | 'FINALIZED_PENDING_DEPARTMENT_HEAD'
  | 'APPROVED'
  | 'REJECTED';

export type CoordinatorNextAction =
  | 'CONFIGURE_WEIGHTS'
  | 'WAIT_FOR_ADVISOR_SUBMISSION'
  | 'WAIT_FOR_EVALUATOR_SUBMISSIONS'
  | 'OPEN_PREVIEW'
  | 'VIEW_FINALIZED_RESULT'
  | 'VIEW_APPROVED_RESULT'
  | 'REVIEW_REJECTED_RESULT';

export interface FinalizeCoordinatorRequest {
  note?: string;
}

export interface CoordinatorDashboardResponse {
  stage: EvaluationStage;
  weights: {
    isConfigured: boolean;
    advisorPercentage: number | null;
    evaluatorPercentage: number | null;
    updatedAt: string | null;
  };
  summary: {
    totalProjectGroups: number;
    waitingForWeightsCount: number;
    waitingForAdvisorCount: number;
    waitingForEvaluatorsCount: number;
    readyForAggregationCount: number;
    finalizedPendingApprovalCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  projectGroups: Array<{
    projectId: string;
    projectTitle: string;
    projectStatus: string;
    group: {
      id: string;
      name: string;
      totalMembers: number;
    } | null;
    advisorEvaluation: {
      status: string;
      submittedAt: string | null;
    };
    evaluatorEvaluation: {
      totalAssignedEvaluators: number;
      submittedEvaluators: number;
      pendingEvaluators: number;
      allSubmitted: boolean;
    };
    aggregationStatus: AggregationStatus;
    finalizationStatus: FinalizationStatus;
    weights: {
      advisorPercentage: number | null;
      evaluatorPercentage: number | null;
    };
    finalizedBy: {
      userId: string;
      fullName: string;
    } | null;
    finalizedAt: string | null;
    approvedAt: string | null;
    hasRejectionReason: boolean;
    nextAction: CoordinatorNextAction;
  }>;
}
```

## Minimal Frontend API Examples

```ts
export async function getCoordinatorDashboard(projectToken: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/coordinator/dashboard?stage=CAPSTONE_I`,
    {
      headers: {
        Authorization: `Bearer ${projectToken}`,
      },
    }
  );

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function getCoordinatorProjectDetail(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/coordinator/projects/${projectId}?stage=CAPSTONE_I`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function previewCoordinatorProject(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/coordinator/projects/${projectId}/preview?stage=CAPSTONE_I`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function finalizeCoordinatorProject(
  projectId: string,
  token: string,
  body: FinalizeCoordinatorRequest
) {
  const response = await fetch(
    `/api/v1/project-evaluations/coordinator/projects/${projectId}/finalize?stage=CAPSTONE_I`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}
```

## Recommended UI Rules

- show dashboard badges using both `aggregationStatus` and `finalizationStatus`
- only show Preview button when `readyForPreview === true`
- only show Finalize button after a successful preview review step
- after finalization, switch the project to read-only coordinator state
- if a project is rejected later, show rejection status on the dashboard and reopen review mode from detail

## Practical Integration Summary

- Use dashboard to list all department projects and decide the next action.
- Use project detail to show raw advisor and evaluator scoring data.
- Use preview as the backend-trusted final-grade confirmation screen.
- Use finalize only after preview review is complete.
- After finalize, treat the project as pending department-head review.