# Frontend Evaluator Project Evaluation Capstone II Integration Guide

This guide explains how to integrate these evaluator endpoints from your frontend for the Capstone II workflow:

- `GET /api/v1/project-evaluations/evaluators/me/dashboard`
- `GET /api/v1/project-evaluations/evaluators/me/projects/{projectId}`
- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/draft`
- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/submit`

The goal is clear frontend integration for the evaluator scoring workflow, including response shapes, request bodies, UI state handling, and the exact rules the backend enforces.

## Scope

This guide is for the evaluator evaluation flow for:

- `CAPSTONE_II`
- logged-in evaluator user
- projects assigned to that evaluator
- student scoring and final evaluator submission for the project group

Important:

- These endpoints require a valid evaluator JWT access token.
- The evaluator routes are currently protected by the `ADVISOR` role in the backend, so the authenticated user must satisfy the backend authorization rules used for evaluator access.
- The backend supports both `CAPSTONE_I` and `CAPSTONE_II`, but this guide is specifically for `CAPSTONE_II` integration.
- The data contract follows the same overall pattern as Capstone I. The main frontend change is using `stage=CAPSTONE_II`.
- Draft save is partial. You can save one student, some students, or all students.
- Submit does not take a request body.
- Submit succeeds only when every active or pending student in the project group already has a saved score.
- After submit, the evaluator evaluation becomes read-only and further draft saves are rejected.
- Unlike advisor submit, evaluator submit is not idempotent. A second submit attempt returns an error.

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

### Step 1: Load evaluator dashboard

Use:

- `GET /api/v1/project-evaluations/evaluators/me/dashboard?stage=CAPSTONE_II`

Use the dashboard to:

- list all assigned project groups
- show evaluator progress for each group
- show advisor and milestone context for each project
- decide which primary action to show

### Step 2: Open one project detail page

Use:

- `GET /api/v1/project-evaluations/evaluators/me/projects/{projectId}?stage=CAPSTONE_II`

Use the detail response to:

- render the project and advisor context
- render the student list for scoring
- prefill previously saved scores and comments
- show approved milestone files for evaluation context
- decide whether the page is editable or already submitted

### Step 3: Score students locally

For each student, collect:

- `studentUserId`
- `score`
- `comment` optional

Recommended frontend rule:

- keep local form state per student
- allow partial progress saves
- do not force the evaluator to score all students before saving draft

### Step 4: Save draft while the evaluator is working

Use:

- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/draft?stage=CAPSTONE_II`

Use this whenever the evaluator clicks Save Draft or when you autosave.

### Step 5: Submit only after all students are scored

Use:

- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/submit?stage=CAPSTONE_II`

Enable Submit only when every student shown in project detail has a valid score.

## Common Status Values You Should Use in Frontend

### Evaluator Evaluation Status

- `NOT_STARTED`
- `IN_PROGRESS`
- `SUBMITTED`

### Student Evaluation Status

- `PENDING`
- `EVALUATED`

## Endpoint 1: Evaluator Dashboard

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/evaluators/me/dashboard?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

## Dashboard Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_II",
  "generatedAt": "2026-04-17T10:00:00.000Z",
  "summary": {
    "totalAssignedProjectGroups": 2,
    "totalAssignedStudents": 6,
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 3,
    "averageScoreGiven": 81.67,
    "pendingProjectGroups": 1,
    "completedProjectGroups": 1,
    "overallMilestoneProgressPercent": 66
  },
  "projectGroups": [
    {
      "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
      "projectTitle": "Smart Campus Navigation",
      "projectStatus": "ACTIVE",
      "group": {
        "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
        "name": "Group Beta",
        "status": "ACTIVE",
        "technologies": ["NestJS", "React", "PostgreSQL"],
        "totalMembers": 3
      },
      "advisor": {
        "id": "advisor-user-id",
        "firstName": "Helen",
        "lastName": "Smith",
        "fullName": "Helen Smith",
        "email": "helen@example.com",
        "avatarUrl": null
      },
      "evaluation": {
        "stage": "CAPSTONE_II",
        "status": "IN_PROGRESS",
        "totalStudents": 3,
        "studentsEvaluated": 2,
        "studentsPendingEvaluation": 1,
        "averageScoreGiven": 81.75,
        "lastSavedAt": "2026-04-17T09:50:00.000Z",
        "submittedAt": null
      },
      "milestones": {
        "total": 4,
        "approved": 3,
        "submitted": 1,
        "pending": 0,
        "rejected": 0,
        "progressPercent": 75
      },
      "groupMembers": [
        {
          "userId": "student-user-id-1",
          "firstName": "John",
          "lastName": "Doe",
          "fullName": "John Doe",
          "email": "john@example.com",
          "avatarUrl": null,
          "evaluationStatus": "EVALUATED"
        },
        {
          "userId": "student-user-id-2",
          "firstName": "Sara",
          "lastName": "Ali",
          "fullName": "Sara Ali",
          "email": "sara@example.com",
          "avatarUrl": null,
          "evaluationStatus": "PENDING"
        }
      ]
    }
  ]
}
```

### How Frontend Should Use Dashboard Response

- render dashboard summary cards using `summary`
- use `projectGroups` for the table or card list
- show evaluator status badge from `evaluation.status`
- show advisor identity to orient the evaluator
- show milestone progress for context, not as an editable workflow state
- use `groupMembers[].evaluationStatus` to show per-student progress from dashboard level

Recommended UI behavior:

- if `evaluation.status === "NOT_STARTED"`, show `Start Evaluation`
- if `evaluation.status === "IN_PROGRESS"`, show `Continue Evaluation`
- if `evaluation.status === "SUBMITTED"`, show `View Submitted Evaluation`

## Dashboard Common Error Cases

### 400: unsupported stage

```json
{
  "message": "Only CAPSTONE_I and CAPSTONE_II are supported for now",
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

### 404: evaluator user missing

```json
{
  "message": "Evaluator user not found",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 2: Evaluator Project Detail

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/evaluators/me/projects/{projectId}?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

## Project Detail Success Response

Status code:

- `200 OK`

Response:

```json
{
  "stage": "CAPSTONE_II",
  "generatedAt": "2026-04-17T10:03:00.000Z",
  "project": {
    "id": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
    "title": "Smart Campus Navigation",
    "status": "ACTIVE",
    "createdAt": "2026-03-01T09:00:00.000Z"
  },
  "advisor": {
    "id": "advisor-user-id",
    "firstName": "Helen",
    "lastName": "Smith",
    "fullName": "Helen Smith",
    "email": "helen@example.com",
    "avatarUrl": null
  },
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Beta",
    "status": "ACTIVE",
    "objectives": "Real-time indoor and outdoor routing for students.",
    "technologies": ["NestJS", "React", "PostgreSQL"],
    "totalMembers": 3,
    "leader": {
      "id": "student-user-id-1",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "avatarUrl": null
    }
  },
  "evaluation": {
    "stage": "CAPSTONE_II",
    "status": "IN_PROGRESS",
    "totalStudents": 3,
    "studentsEvaluated": 2,
    "studentsPendingEvaluation": 1,
    "averageScoreGiven": 81.75,
    "lastSavedAt": "2026-04-17T09:50:00.000Z",
    "submittedAt": null
  },
  "milestoneProgress": {
    "total": 4,
    "approved": 3,
    "submitted": 1,
    "pending": 0,
    "rejected": 0,
    "progressPercent": 75
  },
  "milestones": [
    {
      "id": "milestone-1-id",
      "title": "Prototype Delivery",
      "description": "Deliver functional navigation prototype.",
      "dueDate": "2026-04-05T00:00:00.000Z",
      "status": "APPROVED",
      "submittedAt": "2026-04-03T11:00:00.000Z",
      "approvedSubmission": {
        "submissionId": "submission-1-id",
        "fileName": "prototype-demo.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 245120,
        "fileUrl": "https://example.com/file.pdf",
        "filePublicId": "milestones/prototype-demo",
        "resourceType": "raw",
        "approvedAt": "2026-04-04T12:00:00.000Z",
        "approvedBy": {
          "id": "approver-user-id",
          "firstName": "Advisor",
          "lastName": "Reviewer",
          "fullName": "Advisor Reviewer",
          "email": "reviewer@example.com",
          "avatarUrl": null
        }
      },
      "approvedSubmissionFile": {
        "submissionId": "submission-1-id",
        "fileName": "prototype-demo.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 245120,
        "fileUrl": "https://example.com/file.pdf",
        "filePublicId": "milestones/prototype-demo",
        "resourceType": "raw",
        "approvedAt": "2026-04-04T12:00:00.000Z",
        "approvedBy": {
          "id": "approver-user-id",
          "firstName": "Advisor",
          "lastName": "Reviewer",
          "fullName": "Advisor Reviewer",
          "email": "reviewer@example.com",
          "avatarUrl": null
        }
      }
    }
  ],
  "students": [
    {
      "userId": "student-user-id-1",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "avatarUrl": null,
      "evaluation": {
        "status": "EVALUATED",
        "score": 84.5,
        "comment": "Strong technical delivery and good documentation.",
        "savedAt": "2026-04-17T09:50:00.000Z"
      }
    },
    {
      "userId": "student-user-id-2",
      "firstName": "Sara",
      "lastName": "Ali",
      "fullName": "Sara Ali",
      "email": "sara@example.com",
      "avatarUrl": null,
      "evaluation": {
        "status": "PENDING",
        "score": null,
        "comment": null,
        "savedAt": null
      }
    }
  ]
}
```

### How Frontend Should Use Detail Response

- render project and advisor metadata at the top of the page
- render student rows using `students`
- prefill score and comment fields using `students[].evaluation`
- use `evaluation.status` to decide whether the page is editable
- use `evaluation.averageScoreGiven` for evaluator summary cards if needed
- render milestone context using `milestones` and `milestoneProgress`

Recommended UI behavior:

- if `evaluation.status === "NOT_STARTED"`, show empty scoring form
- if `evaluation.status === "IN_PROGRESS"`, show editable form with saved values
- if `evaluation.status === "SUBMITTED"`, show read-only form and hide Save Draft and Submit buttons

## Project Detail Common Error Cases

### 404: project not found for evaluator

```json
{
  "message": "Project not found for this evaluator",
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

## Endpoint 3: Save Evaluator Draft

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/evaluators/me/projects/{projectId}/draft?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

### Request Body

```json
{
  "students": [
    {
      "studentUserId": "student-user-id-1",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation."
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good work, but needs stronger defense of design decisions."
    }
  ]
}
```

### Body Rules

- `students` is required
- `students` must contain at least 1 item
- `studentUserId` must be a valid UUID
- `score` must be a number from `0` to `100`
- `score` can have up to 2 decimal places
- `comment` is optional
- `comment` max length is `1000`
- duplicate `studentUserId` values in the same request are rejected
- every student in the body must belong to this project group

### Draft Save Behavior

The backend uses partial upsert behavior:

- if the student already has a saved draft score, it is updated
- if the student has no score yet, it is created
- students not included in the request remain unchanged

This means your frontend can safely:

- save one student at a time
- save only changed students
- save the full list on every click

## Save Draft Success Response

Status code:

- `201 Created`

Response:

```json
{
  "message": "Evaluator evaluation draft saved successfully",
  "stage": "CAPSTONE_II",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "evaluation": {
    "status": "IN_PROGRESS",
    "totalStudents": 3,
    "studentsEvaluated": 2,
    "studentsPendingEvaluation": 1,
    "averageScoreGiven": 81.75,
    "lastSavedAt": "2026-04-17T09:50:00.000Z",
    "submittedAt": null
  },
  "savedStudents": [
    {
      "studentUserId": "student-user-id-1",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good work, but needs stronger defense of design decisions.",
      "status": "EVALUATED"
    }
  ]
}
```

### How Frontend Should Use This Response

- show success toast from `message`
- update the page summary from `evaluation`
- update last-saved timestamp from `evaluation.lastSavedAt`
- update average score display from `evaluation.averageScoreGiven`
- update only returned students from `savedStudents`

Recommended UI mapping:

- `evaluation.status === "NOT_STARTED"` -> no scores saved yet
- `evaluation.status === "IN_PROGRESS"` -> editable in-progress draft
- `evaluation.status === "SUBMITTED"` -> read-only state

## Save Draft Common Error Cases

### 400: duplicate students in same request

```json
{
  "message": "Duplicate studentUserId provided: student-user-id-1",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: student does not belong to group

```json
{
  "message": "Student student-user-id-1 does not belong to this project group",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: evaluation already submitted

```json
{
  "message": "Submitted evaluator evaluation cannot be edited",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 404: project not found for evaluator

```json
{
  "message": "Project not found for this evaluator",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 4: Submit Evaluator Evaluation

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/evaluators/me/projects/{projectId}/submit?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

### Request Body

No request body is required.

Send an empty body or no body at all.

Example:

```http
POST /api/v1/project-evaluations/evaluators/me/projects/5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e/submit?stage=CAPSTONE_II
Authorization: Bearer <access_token>
```

## Submit Success Response

Status code:

- `201 Created`

Response:

```json
{
  "message": "Evaluator evaluation submitted successfully",
  "stage": "CAPSTONE_II",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "evaluation": {
    "status": "SUBMITTED",
    "totalStudents": 3,
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 0,
    "averageScoreGiven": 82.17,
    "lastSavedAt": "2026-04-17T10:00:00.000Z",
    "submittedAt": "2026-04-17T10:00:00.000Z"
  },
  "submittedStudents": [
    {
      "studentUserId": "student-user-id-1",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good work, but needs stronger defense of design decisions.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-3",
      "score": 83,
      "comment": "Good implementation quality.",
      "status": "EVALUATED"
    }
  ]
}
```

### How Frontend Should Use This Response

- switch the screen into read-only mode
- disable all score and comment inputs
- hide Save Draft button
- hide or disable Submit button
- show submitted timestamp from `evaluation.submittedAt`
- keep `submittedStudents` in local state if you want a confirmation view

## Submit Common Error Cases

### 400: one or more students are missing scores

```json
{
  "message": "All students must be evaluated before submit. Missing studentUserIds: student-user-id-3",
  "error": "Bad Request",
  "statusCode": 400
}
```

Frontend handling:

- do not show a generic error only
- parse the message
- highlight the missing students in the page if possible

### 400: evaluation already submitted

```json
{
  "message": "Evaluator evaluation has already been submitted",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: no students in the project group

```json
{
  "message": "No students found for this project group",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 404: no draft exists yet

```json
{
  "message": "Evaluator evaluation draft not found",
  "error": "Not Found",
  "statusCode": 404
}
```

Frontend handling:

- first save at least one draft score before submit

## Minimal Frontend Types

```ts
export type EvaluationStage = 'CAPSTONE_II';

export type EvaluatorEvaluationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export type StudentEvaluationStatus = 'PENDING' | 'EVALUATED';

export interface SaveEvaluatorDraftStudentInput {
  studentUserId: string;
  score: number;
  comment?: string;
}

export interface SaveEvaluatorDraftRequest {
  students: SaveEvaluatorDraftStudentInput[];
}

export interface EvaluatorEvaluationSummary {
  stage: EvaluationStage;
  status: EvaluatorEvaluationStatus;
  totalStudents: number;
  studentsEvaluated: number;
  studentsPendingEvaluation: number;
  averageScoreGiven: number;
  lastSavedAt: string | null;
  submittedAt: string | null;
}

export interface EvaluatorSavedStudent {
  studentUserId: string;
  score: number;
  comment: string | null;
  status: 'EVALUATED';
}

export interface EvaluatorDashboardResponse {
  stage: EvaluationStage;
  generatedAt: string;
  summary: {
    totalAssignedProjectGroups: number;
    totalAssignedStudents: number;
    studentsEvaluated: number;
    studentsPendingEvaluation: number;
    averageScoreGiven: number;
    pendingProjectGroups: number;
    completedProjectGroups: number;
    overallMilestoneProgressPercent: number;
  };
  projectGroups: Array<{
    projectId: string;
    projectTitle: string;
    projectStatus: string;
    group: {
      id: string;
      name: string;
      status: string;
      technologies: unknown;
      totalMembers: number;
    } | null;
    advisor: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
    } | null;
    evaluation: EvaluatorEvaluationSummary;
    milestones: {
      total: number;
      approved: number;
      submitted: number;
      pending: number;
      rejected: number;
      progressPercent: number;
    };
    groupMembers: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
      evaluationStatus: StudentEvaluationStatus;
    }>;
  }>;
}

export interface SaveEvaluatorDraftResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: Omit<EvaluatorEvaluationSummary, 'stage'>;
  savedStudents: EvaluatorSavedStudent[];
}

export interface SubmitEvaluatorEvaluationResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: Omit<EvaluatorEvaluationSummary, 'stage'>;
  submittedStudents: EvaluatorSavedStudent[];
}
```

## Minimal Frontend API Examples

```ts
export async function getEvaluatorDashboard(token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/dashboard?stage=CAPSTONE_II`,
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

export async function getEvaluatorProjectDetail(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/projects/${projectId}?stage=CAPSTONE_II`,
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

export async function saveEvaluatorDraft(
  projectId: string,
  token: string,
  body: SaveEvaluatorDraftRequest
) {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/projects/${projectId}/draft?stage=CAPSTONE_II`,
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

export async function submitEvaluatorEvaluation(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/projects/${projectId}/submit?stage=CAPSTONE_II`,
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
```

## Recommended UI Rules

- always load dashboard first, then open detail from a selected project
- use `project detail` as the source of truth for the student list
- allow partial draft saves
- disable Submit until all students in detail have scores locally
- after submit, force the screen into read-only mode
- if backend returns `Submitted evaluator evaluation cannot be edited`, refresh detail and lock the screen immediately
- if backend returns `Evaluator evaluation has already been submitted`, keep the screen read-only and do not retry submit automatically
- treat milestone data as context for review, not as editable data in this screen

## Practical Integration Summary

- Use dashboard to list assigned Capstone II projects and evaluator progress.
- Use project detail to render the scoring page and prefill saved values.
- Use draft to save partial progress for one or many students.
- Use submit only after every student has been scored.
- After submit, render the evaluator evaluation as read-only.