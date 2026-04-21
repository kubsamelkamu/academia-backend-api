# Frontend Department-Head Project Evaluation Capstone II Integration Guide

This guide explains how to integrate these department-head endpoints from your frontend for the Capstone II workflow:

- `GET /api/v1/project-evaluations/department-head/dashboard`
- `GET /api/v1/project-evaluations/department-head/projects/{projectId}`
- `POST /api/v1/project-evaluations/department-head/projects/{projectId}/approve`
- `POST /api/v1/project-evaluations/department-head/projects/{projectId}/reject`

The goal is clear frontend integration for the department-head review workflow, including request bodies, response shapes, status handling, and common error cases.

## Scope

This guide is for the department-head grading review flow for:

- `CAPSTONE_II`
- logged-in department-head user
- finalized coordinator results inside the department-head's department

Important:

- These endpoints require a valid department-head JWT access token.
- The backend supports both `CAPSTONE_I` and `CAPSTONE_II`, but this guide is specifically for `CAPSTONE_II` integration.
- Department-head reviews finalized results only. This is not a scoring screen.
- Approve publishes the final result for student visibility.
- Reject sends the result back for coordinator re-finalization.

## One Important Integration Note

The backend uses a global response wrapper. In many environments, your frontend will receive this shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "stage": "CAPSTONE_II"
  },
  "timestamp": "2026-04-17T10:00:00.000Z"
}
```

In the examples below, the JSON samples show the inner payload returned by the service. If your frontend HTTP client receives the wrapped form, read the actual endpoint payload from `data`.

## Recommended Stepwise Frontend Flow

### Step 1: Load department-head dashboard

Use:

- `GET /api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_II`

Use the dashboard to:

- render pending review rows
- render approved and rejected history rows
- show which items still need action

### Step 2: Open one finalized project detail page

Use:

- `GET /api/v1/project-evaluations/department-head/projects/{projectId}?stage=CAPSTONE_II`

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
- URL: `/api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

## Dashboard Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_II",
  "weights": {
    "isConfigured": true,
    "advisorPercentage": 40,
    "evaluatorPercentage": 60,
    "updatedAt": "2026-04-17T10:15:00.000Z"
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
      "projectTitle": "Smart Campus Navigation",
      "group": {
        "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
        "name": "Group Beta",
        "totalMembers": 3
      },
      "finalizationStatus": "FINALIZED_PENDING_DEPARTMENT_HEAD",
      "weights": {
        "advisorPercentage": 40,
        "evaluatorPercentage": 60
      },
      "finalizedBy": {
        "userId": "coordinator-user-id",
        "fullName": "Coordinator Mary"
      },
      "finalizedAt": "2026-04-17T10:42:00.000Z",
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
- show current department Capstone II weights from `weights`
- use `finalizationStatus` for state badges
- use `nextAction` to decide the primary row CTA

Recommended mapping:

- `REVIEW_FINALIZED_RESULT` -> open detail with Approve and Reject buttons
- `VIEW_APPROVED_RESULT` -> open detail read-only approved mode
- `REVIEW_REJECTED_RESULT` -> open detail read-only rejected mode with reason and history visible

## Dashboard Common Error Cases

### 400: unsupported stage

```json
{
  "message": "Only CAPSTONE_I and CAPSTONE_II are supported for now",
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
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

## Project Detail Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_II",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "Smart Campus Navigation",
    "status": "ACTIVE",
    "createdAt": "2026-03-01T09:00:00.000Z"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Beta",
    "status": "ACTIVE",
    "totalMembers": 3,
    "leader": {
      "userId": "student-user-id-1",
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
      "userId": "coordinator-user-id",
      "fullName": "Coordinator Mary"
    },
    "finalizedAt": "2026-04-17T10:42:00.000Z",
    "finalizationNote": "Reviewed and ready for department-head approval.",
    "approvedAt": null,
    "approvalNote": null,
    "rejectedAt": null,
    "rejectionReason": null
  },
  "advisorEvaluation": {
    "status": "SUBMITTED",
    "submittedAt": "2026-04-17T09:00:00.000Z"
  },
  "evaluatorEvaluation": {
    "totalAssignedEvaluators": 2,
    "submittedEvaluators": 2,
    "evaluators": [
      {
        "evaluatorUserId": "evaluator-user-id-1",
        "fullName": "Dr Jane Smith",
        "email": "jane@example.com",
        "status": "SUBMITTED",
        "submittedAt": "2026-04-17T08:40:00.000Z"
      }
    ]
  },
  "students": [
    {
      "studentUserId": "student-user-id-1",
      "fullName": "John Doe",
      "email": "john@example.com",
      "advisorScore": {
        "score": 82,
        "comment": "Strong ownership and steady progress."
      },
      "evaluatorScores": [
        {
          "evaluatorUserId": "evaluator-user-id-1",
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
          "evaluatorUserId": "evaluator-user-id-1",
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
        "userId": "coordinator-user-id",
        "fullName": "Coordinator Mary"
      },
      "actedAt": "2026-04-17T10:42:00.000Z",
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
- use `finalResult.status` to decide whether approve and reject buttons should show

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
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}/approve?stage=CAPSTONE_II`
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
  "stage": "CAPSTONE_II",
  "status": "APPROVED",
  "finalizedBy": {
    "userId": "coordinator-user-id",
    "fullName": "Coordinator Mary"
  },
  "finalizedAt": "2026-04-17T10:42:00.000Z",
  "approvedBy": {
    "userId": "department-head-user-id",
    "fullName": "Dr Head Reviewer"
  },
  "approvedAt": "2026-04-17T11:10:00.000Z",
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
- URL: `/api/v1/project-evaluations/department-head/projects/{projectId}/reject?stage=CAPSTONE_II`
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
  "stage": "CAPSTONE_II",
  "status": "REJECTED",
  "finalizedBy": {
    "userId": "coordinator-user-id",
    "fullName": "Coordinator Mary"
  },
  "finalizedAt": "2026-04-17T10:42:00.000Z",
  "rejectedBy": {
    "userId": "department-head-user-id",
    "fullName": "Dr Head Reviewer"
  },
  "rejectedAt": "2026-04-17T11:15:00.000Z",
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
export type EvaluationStage = 'CAPSTONE_II';

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
    `/api/v1/project-evaluations/department-head/dashboard?stage=CAPSTONE_II`,
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
    `/api/v1/project-evaluations/department-head/projects/${projectId}?stage=CAPSTONE_II`,
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
    `/api/v1/project-evaluations/department-head/projects/${projectId}/approve?stage=CAPSTONE_II`,
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
    `/api/v1/project-evaluations/department-head/projects/${projectId}/reject?stage=CAPSTONE_II`,
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

- Use dashboard to list pending, approved, and rejected finalized Capstone II results.
- Use project detail to inspect the final snapshot and the raw advisor and evaluator comments.
- Use approve to publish the finalized result.
- Use reject to send the result back for coordinator correction and re-finalization.
- After review action, switch the project into read-only state and refresh the dashboard.