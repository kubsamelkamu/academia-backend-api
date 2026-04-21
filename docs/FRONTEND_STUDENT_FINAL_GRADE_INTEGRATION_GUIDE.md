# Frontend Student Final Grade Integration Guide

This guide explains how to integrate the student final-grade endpoint from your frontend:

- `GET /api/v1/project-evaluations/students/me/final-grade`

The goal is clear frontend integration for student final-grade visibility, including response states, UI handling, and common error cases.

## Scope

This guide is for the student final-grade visibility flow for:

- `CAPSTONE_I`
- logged-in student user
- student who belongs to a project group with a possible finalized result

Important:

- This endpoint requires a valid student JWT access token.
- Only `CAPSTONE_I` is currently supported.
- Students only see their own final grade.
- Students do not see raw evaluator comments through this endpoint.
- A result becomes fully visible only after department-head approval.

## Recommended Stepwise Frontend Flow

### Step 1: Load the student final grade screen

Use:

- `GET /api/v1/project-evaluations/students/me/final-grade?stage=CAPSTONE_I`

### Step 2: Handle one of three response states

Your frontend should support three main states:

1. No finalized result exists yet
2. A finalized result exists but is not published yet
3. A finalized result is approved and published

## Endpoint: Student Final Grade

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/students/me/final-grade?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`

## Response State 1: No Finalized Result Yet

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "isPublished": false,
  "status": "NOT_AVAILABLE",
  "message": "No finalized result is available for this stage yet."
}
```

### How Frontend Should Use This State

- show an empty-state card
- do not show any final grade values
- show the backend message directly or a friendly equivalent

Recommended UI message:

- `Your final grade is not available yet.`

## Response State 2A: Finalized But Still Pending Approval

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "isPublished": false,
  "status": "FINALIZED_PENDING_DEPARTMENT_HEAD",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "AI Attendance Monitoring",
    "status": "ACTIVE"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Alpha",
    "status": "ACTIVE",
    "totalMembers": 3
  },
  "message": "Your final result is not published yet. It is still awaiting department-head approval."
}
```

### How Frontend Should Use This State

- show project and group identity
- do not show `finalGrade`, `letterGrade`, or weighted scores
- show a pending-publication info banner

Recommended UI message:

- `Your final grade has been prepared and is awaiting department-head approval.`

## Response State 2B: Finalized But Rejected

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "isPublished": false,
  "status": "REJECTED",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "AI Attendance Monitoring",
    "status": "ACTIVE"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Alpha",
    "status": "ACTIVE",
    "totalMembers": 3
  },
  "message": "Your final result is not published because it was returned for coordinator review."
}
```

### How Frontend Should Use This State

- show project and group info
- do not show final grade values
- show a status banner indicating the result is under review again

Recommended UI message:

- `Your final grade is being reviewed again and is not published yet.`

## Response State 3: Published Final Grade

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_I",
  "isPublished": true,
  "status": "APPROVED",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "AI Attendance Monitoring",
    "status": "ACTIVE"
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Alpha",
    "status": "ACTIVE",
    "totalMembers": 3
  },
  "weights": {
    "advisorPercentage": 40,
    "evaluatorPercentage": 60
  },
  "scores": {
    "advisorScore": 82,
    "evaluatorAverageScore": 84,
    "finalGrade": 83.2,
    "letterGrade": "A-"
  },
  "finalizedAt": "2026-04-16T10:42:00.000Z",
  "publishedAt": "2026-04-16T11:10:00.000Z",
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

### How Frontend Should Use This State

- show final grade and letter grade prominently
- show project and group summary
- optionally show weighted breakdown
- show `publishedAt` as the publish date
- show `finalizedAt` if you want a secondary timeline detail

Recommended display sections:

- project title
- group name
- final grade
- letter grade
- advisor percentage and evaluator percentage
- published date

## Common Error Cases

### 400: unsupported stage

```json
{
  "message": "Only CAPSTONE_I is supported for now",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 403: missing user context

```json
{
  "message": "Missing user context",
  "error": "Forbidden",
  "statusCode": 403
}
```

## Minimal Frontend Types

```ts
export type EvaluationStage = 'CAPSTONE_I';

export type StudentFinalGradeStatus =
  | 'NOT_AVAILABLE'
  | 'FINALIZED_PENDING_DEPARTMENT_HEAD'
  | 'REJECTED'
  | 'APPROVED';

export interface StudentFinalGradeNotAvailableResponse {
  stage: EvaluationStage;
  isPublished: false;
  status: 'NOT_AVAILABLE';
  message: string;
}

export interface StudentFinalGradePendingResponse {
  stage: EvaluationStage;
  isPublished: false;
  status: 'FINALIZED_PENDING_DEPARTMENT_HEAD' | 'REJECTED';
  project: {
    id: string;
    title: string;
    status: string;
  };
  group: {
    id: string;
    name: string;
    status: string;
    totalMembers: number;
  } | null;
  message: string;
}

export interface StudentFinalGradePublishedResponse {
  stage: EvaluationStage;
  isPublished: true;
  status: 'APPROVED';
  project: {
    id: string;
    title: string;
    status: string;
  };
  group: {
    id: string;
    name: string;
    status: string;
    totalMembers: number;
  } | null;
  weights: {
    advisorPercentage: number;
    evaluatorPercentage: number;
  };
  scores: {
    advisorScore: number;
    evaluatorAverageScore: number;
    finalGrade: number;
    letterGrade: string;
  };
  finalizedAt: string;
  publishedAt: string | null;
  roundedToDecimalPlaces: 2;
  gradeScale: Record<string, { min: number; max: number }>;
}

export type StudentFinalGradeResponse =
  | StudentFinalGradeNotAvailableResponse
  | StudentFinalGradePendingResponse
  | StudentFinalGradePublishedResponse;
```

## Minimal Frontend API Example

```ts
export async function getStudentFinalGrade(token: string): Promise<StudentFinalGradeResponse> {
  const response = await fetch(
    `/api/v1/project-evaluations/students/me/final-grade?stage=CAPSTONE_I`,
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
```

## Recommended UI Rules

- always branch UI by `isPublished` and `status`
- never assume a final grade exists just because the student belongs to a project group
- only show final numeric grade when `isPublished === true`
- show a neutral informational state when not published yet
- keep the student view read-only at all times

## Practical Integration Summary

- Use the endpoint to decide whether there is no result, a pending result, or a published result.
- Only show final grade values when the result is approved and published.
- For pending or rejected states, show project context and a clear status message instead of grade values.