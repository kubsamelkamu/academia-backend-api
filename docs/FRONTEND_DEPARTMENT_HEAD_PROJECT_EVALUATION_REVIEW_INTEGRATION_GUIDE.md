# Frontend Department-Head Project Evaluation Review Integration Guide

This guide explains how to integrate these department-head endpoints from your frontend:

- `GET /api/v1/project-evaluations/department-head/dashboard`
- `GET /api/v1/project-evaluations/department-head/projects/{projectId}`
- `POST /api/v1/project-evaluations/department-head/projects/{projectId}/approve`
- `POST /api/v1/project-evaluations/department-head/projects/{projectId}/reject`

The goal is clear frontend integration for the department-head review workflow, including request bodies, response shapes, status handling, and common error cases.

## Scope

This guide is for the department-head grading review flow for:

- `CAPSTONE_I`
- logged-in department-head user
- finalized coordinator results inside the department-head's department

Important:

- These endpoints require a valid department-head JWT access token.
- Only `CAPSTONE_I` is currently supported.
- Department-head reviews finalized results only. This is not a scoring screen.
- Approve publishes the final result for student visibility.
- Reject sends the result back for coordinator re-finalization.

## Recommended Stepwise Frontend Flow

### Step 1: Load department-head dashboard

Use:

- `GET /api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_I`

Use the dashboard to:

- render pending review rows
- render approved and rejected history rows
- show which items still need action

### Step 2: Open one finalized project detail page

Use:

- `GET /api/v1/project-evaluations/department-head/projects/{projectId}?stage=CAPSTONE_I`

Use the detail response to:

- show final result summary
- show raw advisor comments and evaluator comments
- show per-student final grade and letter grade
- show review history

### Step 3: Approve or reject after review

If the result is correct:

- call `approve`

If the result should go back to coordinator:

- call `reject`

## Common Status Values You Should Use in Frontend

### Finalization Status

- `FINALIZED_PENDING_DEPARTMENT_HEAD`
- `APPROVED`
- `REJECTED`

### Dashboard Next Action

- `REVIEW_FINALIZED_RESULT`
- `VIEW_APPROVED_RESULT`
- `REVIEW_REJECTED_RESULT`

## Endpoint 1: Department-Head Dashboard

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_I`
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
    "totalFinalizedProjectGroups": 3,
    "pendingReviewCount": 1,
    "approvedCount": 1,
    "rejectedCount": 1
  },
  "projectGroups": [
    {
      "finalResultId": "3b9989a6-c9fb-49b7-8597-3eac7427c991",
      "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
      "projectTitle": "AI Attendance Monitoring",
      "group": {
        "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
        "name": "Group Alpha",
        "totalMembers": 3
      },
      "finalizationStatus": "FINALIZED_PENDING_DEPARTMENT_HEAD",
      "weights": {
        "advisorPercentage": 40,
        "evaluatorPercentage": 60
      },
      "finalizedBy": {
        "userId": "95dfdb11-fb64-4939-8618-c7e321d05344",
        "fullName": "Coordinator Mary"
      },
      "finalizedAt": "2026-04-16T10:42:00.000Z",
      "approvedAt": null,
      "rejectedAt": null,
      "reviewedBy": null,
      "hasApprovalNote": false,
      "hasRejectionReason": false,
      "nextAction": "REVIEW_FINALIZED_RESULT"
    }
  ]
}
```

### How Frontend Should Use Dashboard Response

- render counters from `summary`
- show current department weights from `weights`
- use `finalizationStatus` for state badges
- use `nextAction` to decide the primary row CTA

Recommended mapping:

- `REVIEW_FINALIZED_RESULT` -> open detail with Approve and Reject buttons
- `VIEW_APPROVED_RESULT` -> open detail read-only approved mode
- `REVIEW_REJECTED_RESULT` -> open detail read-only rejected mode with reason/history visible

## Dashboard Common Error Cases

### 400: unsupported stage

```json
{
  "message": "Only CAPSTONE_I is supported for now",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 403: department head has no department

```json
{
  "message": "Department head is not assigned to a department",
  "error": "Forbidden",
  "statusCode": 403
}
```

### 404: department head user not found

```json
{
  "message": "Department head user not found",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 2: Department-Head Project Detail

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}?stage=CAPSTONE_I`
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
  "finalResult": {
    "id": "3b9989a6-c9fb-49b7-8597-3eac7427c991",
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
    "finalizationNote": "Reviewed and ready for department-head approval.",
    "approvedAt": null,
    "approvalNote": null,
    "rejectedAt": null,
    "rejectionReason": null
  },
  "advisorEvaluation": {
    "status": "SUBMITTED",
    "submittedAt": "2026-04-16T09:00:00.000Z"
  },
  "evaluatorEvaluation": {
    "totalAssignedEvaluators": 2,
    "submittedEvaluators": 2,
    "evaluators": [
      {
        "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
        "fullName": "Dr Jane Smith",
        "email": "jane@example.com",
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
        "comment": "Good project ownership and documentation."
      },
      "evaluatorScores": [
        {
          "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
          "evaluatorName": "Dr Jane Smith",
          "score": 84,
          "comment": "Clear explanation and solid implementation.",
          "status": "EVALUATED"
        }
      ],
      "evaluatorAverageScore": 82,
      "finalGrade": 82,
      "letterGrade": "A-",
      "finalizedEvaluatorScores": [
        {
          "evaluatorUserId": "a338c2d3-f804-43e5-989f-53958a362f10",
          "evaluatorName": "Dr Jane Smith",
          "score": 84,
          "comment": "Clear explanation and solid implementation."
        }
      ]
    }
  ],
  "reviewHistory": [
    {
      "action": "FINALIZED",
      "status": "FINALIZED_PENDING_DEPARTMENT_HEAD",
      "actedBy": {
        "userId": "95dfdb11-fb64-4939-8618-c7e321d05344",
        "fullName": "Coordinator Mary"
      },
      "actedAt": "2026-04-16T10:42:00.000Z",
      "note": "Reviewed and ready for department-head approval."
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
  }
}
```

### How Frontend Should Use Detail Response

- render the final snapshot from `finalResult`
- render raw advisor and evaluator comments from `students`
- render `reviewHistory` always, even if it currently has only one entry
- use `finalResult.status` to decide whether approve/reject buttons should show

Recommended UI behavior:

- if `finalResult.status === "FINALIZED_PENDING_DEPARTMENT_HEAD"`, show Approve and Reject actions
- if `finalResult.status === "APPROVED"`, show read-only approved state
- if `finalResult.status === "REJECTED"`, show read-only rejected state and rejection reason

## Project Detail Common Error Cases

### 404: finalized result not found

```json
{
  "message": "Finalized project result not found for this department head",
  "error": "Not Found",
  "statusCode": 404
}
```

### 400: project group missing

```json
{
  "message": "Project group not found for this project",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Endpoint 3: Approve Finalized Grades

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}/approve?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

### Request Body

`note` is optional.

```json
{
  "note": "Approved after review of comments and final scores."
}
```

### Body Rules

- `note` is optional
- `note` max length is `1000`

## Approve Success Response

Status code:

- `201 Created`

Response:

```json
{
  "finalResultId": "3b9989a6-c9fb-49b7-8597-3eac7427c991",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "stage": "CAPSTONE_I",
  "status": "APPROVED",
  "finalizedBy": {
    "userId": "95dfdb11-fb64-4939-8618-c7e321d05344",
    "fullName": "Coordinator Mary"
  },
  "finalizedAt": "2026-04-16T10:42:00.000Z",
  "approvedBy": {
    "userId": "2f711a49-30f9-4c1c-9212-5a5c3cd19177",
    "fullName": "Dr Head Reviewer"
  },
  "approvedAt": "2026-04-16T11:10:00.000Z",
  "note": "Approved after review of comments and final scores."
}
```

### How Frontend Should Use Approve Response

- switch the page to approved read-only mode
- remove Approve and Reject buttons
- show approved badge, approver name, and approved time
- optionally redirect back to dashboard and refresh counts

Important:

- student notifications are triggered best-effort in the backend after successful approval
- approval itself does not depend on notification success

## Approve Common Error Cases

### 404: finalized result not found

```json
{
  "message": "Finalized project result not found for this department head",
  "error": "Not Found",
  "statusCode": 404
}
```

### 400: already approved

```json
{
  "message": "Final grade has already been approved for this project and stage",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: currently rejected

```json
{
  "message": "Rejected final grade must be re-finalized by the coordinator before approval",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Endpoint 4: Reject Finalized Grades

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}/reject?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

### Request Body

`reason` is required.

```json
{
  "reason": "Evaluator comments are complete, but the finalization note is missing key review context. Please revise and resubmit."
}
```

### Body Rules

- `reason` is required
- `reason` must not be empty
- `reason` max length is `1000`

## Reject Success Response

Status code:

- `201 Created`

Response:

```json
{
  "finalResultId": "3b9989a6-c9fb-49b7-8597-3eac7427c991",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "stage": "CAPSTONE_I",
  "status": "REJECTED",
  "finalizedBy": {
    "userId": "95dfdb11-fb64-4939-8618-c7e321d05344",
    "fullName": "Coordinator Mary"
  },
  "finalizedAt": "2026-04-16T10:42:00.000Z",
  "rejectedBy": {
    "userId": "2f711a49-30f9-4c1c-9212-5a5c3cd19177",
    "fullName": "Dr Head Reviewer"
  },
  "rejectedAt": "2026-04-16T11:15:00.000Z",
  "reason": "Evaluator comments are complete, but the finalization note is missing key review context. Please revise and resubmit."
}
```

### How Frontend Should Use Reject Response

- switch the page to rejected read-only mode
- remove Approve and Reject buttons
- show rejection reason prominently
- optionally redirect back to dashboard and refresh counts

Important:

- coordinator notification is triggered best-effort in the backend after successful rejection
- rejection itself does not depend on notification success

## Reject Common Error Cases

### 404: finalized result not found

```json
{
  "message": "Finalized project result not found for this department head",
  "error": "Not Found",
  "statusCode": 404
}
```

### 400: already approved

```json
{
  "message": "Approved final grade cannot be rejected",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: already rejected

```json
{
  "message": "Final grade has already been rejected for this project and stage",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: missing rejection reason

Example validation-style response:

```json
{
  "message": [
    "reason should not be empty",
    "reason must be a string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

## Minimal Frontend Types

```ts
export type EvaluationStage = 'CAPSTONE_I';

export type DepartmentHeadNextAction =
  | 'REVIEW_FINALIZED_RESULT'
  | 'VIEW_APPROVED_RESULT'
  | 'REVIEW_REJECTED_RESULT';

export type DepartmentHeadFinalizationStatus =
  | 'FINALIZED_PENDING_DEPARTMENT_HEAD'
  | 'APPROVED'
  | 'REJECTED';

export interface ApproveDepartmentHeadRequest {
  note?: string;
}

export interface RejectDepartmentHeadRequest {
  reason: string;
}

export interface DepartmentHeadDashboardResponse {
  stage: EvaluationStage;
  weights: {
    isConfigured: boolean;
    advisorPercentage: number | null;
    evaluatorPercentage: number | null;
    updatedAt: string | null;
  };
  summary: {
    totalFinalizedProjectGroups: number;
    pendingReviewCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  projectGroups: Array<{
    finalResultId: string;
    projectId: string;
    projectTitle: string;
    group: {
      id: string;
      name: string;
      totalMembers: number;
    } | null;
    finalizationStatus: DepartmentHeadFinalizationStatus;
    weights: {
      advisorPercentage: number;
      evaluatorPercentage: number;
    };
    finalizedBy: {
      userId: string;
      fullName: string;
    };
    finalizedAt: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    reviewedBy: {
      userId: string;
      fullName: string;
    } | null;
    hasApprovalNote: boolean;
    hasRejectionReason: boolean;
    nextAction: DepartmentHeadNextAction;
  }>;
}
```

## Minimal Frontend API Examples

```ts
export async function getDepartmentHeadDashboard(token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_I`,
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

export async function getDepartmentHeadProjectDetail(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/department-head/projects/${projectId}?stage=CAPSTONE_I`,
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

export async function approveDepartmentHeadProject(
  projectId: string,
  token: string,
  body: ApproveDepartmentHeadRequest
) {
  const response = await fetch(
    `/api/v1/project-evaluations/department-head/projects/${projectId}/approve?stage=CAPSTONE_I`,
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

export async function rejectDepartmentHeadProject(
  projectId: string,
  token: string,
  body: RejectDepartmentHeadRequest
) {
  const response = await fetch(
    `/api/v1/project-evaluations/department-head/projects/${projectId}/reject?stage=CAPSTONE_I`,
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

- show Approve and Reject buttons only when status is `FINALIZED_PENDING_DEPARTMENT_HEAD`
- make `reason` mandatory in the reject modal
- make `note` optional in the approve modal
- show `reviewHistory` in chronological order
- after approve or reject, refresh dashboard counters and row state
- treat approved and rejected results as read-only in the department-head UI

## Practical Integration Summary

- Use dashboard to list pending, approved, and rejected finalized results.
- Use project detail to inspect the final snapshot and the raw advisor/evaluator comments.
- Use approve to publish the finalized result.
- Use reject to send the result back for coordinator correction and re-finalization.
- After review action, switch the project into read-only state and refresh the dashboard.