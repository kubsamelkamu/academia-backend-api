# Frontend Evaluator Project Evaluation Draft + Submit Integration Guide

This guide explains how to integrate these two evaluator endpoints from your frontend:

- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/draft`
- `POST /api/v1/project-evaluations/evaluators/me/projects/{projectId}/submit`

The goal is simple frontend integration with clear request bodies, response shapes, and step-by-step UI behavior.

## Scope

This guide is only for the evaluator scoring flow for:

- `CAPSTONE_I`
- logged-in evaluator user
- one assigned project at a time

Important:

- The evaluator routes are protected by the `ADVISOR` role in the backend, so your frontend should use a valid advisor/evaluator JWT access token.
- Draft save is partial. You can send one student, some students, or all students.
- Submit does not take a request body.
- Submit only succeeds when all students in the project group already have saved scores.
- After submit, the evaluator record is locked and draft saves are rejected.

## Recommended Stepwise Frontend Flow

### Step 1: Load project detail first

Before saving or submitting, load:

- `GET /api/v1/project-evaluations/evaluators/me/projects/{projectId}?stage=CAPSTONE_I`

Use this response to:

- show all students in the group
- prefill saved scores/comments
- know whether the evaluation is already submitted
- decide whether the Submit button should be enabled

### Step 2: Let evaluator score students locally

For each student, collect:

- `studentUserId`
- `score`
- `comment` (optional)

Recommended frontend rule:

- keep local form state per student
- autosave per student or save in small batches
- do not wait for all students before using the draft endpoint

### Step 3: Save draft while evaluator is working

Use the draft endpoint whenever the evaluator clicks Save Draft or when you autosave.

### Step 4: Submit only when all students are scored

Enable Submit only when every student has a valid score in the UI.

Even if your frontend enables it too early, the backend still protects the workflow and will reject submit if any student is missing.

## Endpoint 1: Save Draft

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/evaluators/me/projects/{projectId}/draft?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

### Request Body

```json
{
  "students": [
    {
      "studentUserId": "0d4e2ce1-2d46-4e4d-8f4f-95a46e3d0f27",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation."
    },
    {
      "studentUserId": "aa8f56d5-95f1-40b0-bcec-89d9ffbdb4db",
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
- student must belong to the project group

### Draft Save Behavior

The backend does partial upsert behavior:

- if a student already has a draft score, it is updated
- if a student has no score yet, it is created
- students not included in the request are kept as they are

This means your frontend can safely:

- save one student at a time
- save only changed students
- save the entire list every time

## Save Draft Success Response

Status code:

- `201 Created`

Response:

```json
{
  "message": "Evaluator evaluation draft saved successfully",
  "stage": "CAPSTONE_I",
  "projectId": "8e3fbc57-4c93-4d2e-a6bd-f77f3f7a9d10",
  "evaluation": {
    "status": "IN_PROGRESS",
    "totalStudents": 3,
    "studentsEvaluated": 2,
    "studentsPendingEvaluation": 1,
    "averageScoreGiven": 81.75,
    "lastSavedAt": "2026-04-16T09:12:10.442Z",
    "submittedAt": null
  },
  "savedStudents": [
    {
      "studentUserId": "0d4e2ce1-2d46-4e4d-8f4f-95a46e3d0f27",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "aa8f56d5-95f1-40b0-bcec-89d9ffbdb4db",
      "score": 79,
      "comment": "Good work, but needs stronger defense of design decisions.",
      "status": "EVALUATED"
    }
  ]
}
```

### How Frontend Should Use This Response

- show success toast using `message`
- update top summary using `evaluation`
- update the saved timestamp using `evaluation.lastSavedAt`
- mark returned students as saved/evaluated using `savedStudents`

Recommended UI mapping:

- `evaluation.status === "NOT_STARTED"` -> no score saved yet
- `evaluation.status === "IN_PROGRESS"` -> draft work in progress
- `evaluation.status === "SUBMITTED"` -> read-only state

## Save Draft Common Error Cases

### 400: duplicate students in same request

Example message:

```json
{
  "message": "Duplicate studentUserId provided: 0d4e2ce1-2d46-4e4d-8f4f-95a46e3d0f27",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: student does not belong to group

Example message:

```json
{
  "message": "Student 0d4e2ce1-2d46-4e4d-8f4f-95a46e3d0f27 does not belong to this project group",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 400: evaluation already submitted

Example message:

```json
{
  "message": "Submitted evaluator evaluation cannot be edited",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 404: evaluator not assigned or project not found

Example message:

```json
{
  "message": "Project not found for this evaluator",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 2: Submit Evaluation

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/evaluators/me/projects/{projectId}/submit?stage=CAPSTONE_I`
- Headers:
  - `Authorization: Bearer <access_token>`

### Request Body

No request body is required.

Send an empty body or no body at all.

Example:

```http
POST /api/v1/project-evaluations/evaluators/me/projects/8e3fbc57-4c93-4d2e-a6bd-f77f3f7a9d10/submit?stage=CAPSTONE_I
Authorization: Bearer <access_token>
```

## Submit Success Response

Status code:

- `201 Created`

Response:

```json
{
  "message": "Evaluator evaluation submitted successfully",
  "stage": "CAPSTONE_I",
  "projectId": "8e3fbc57-4c93-4d2e-a6bd-f77f3f7a9d10",
  "evaluation": {
    "status": "SUBMITTED",
    "totalStudents": 3,
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 0,
    "averageScoreGiven": 82.17,
    "lastSavedAt": "2026-04-16T09:20:41.100Z",
    "submittedAt": "2026-04-16T09:21:08.400Z"
  },
  "submittedStudents": [
    {
      "studentUserId": "0d4e2ce1-2d46-4e4d-8f4f-95a46e3d0f27",
      "score": 84.5,
      "comment": "Strong technical delivery and good documentation.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "aa8f56d5-95f1-40b0-bcec-89d9ffbdb4db",
      "score": 79,
      "comment": "Good work, but needs stronger defense of design decisions.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "4c4c8e56-09f8-45e0-bb7f-b99190ab70be",
      "score": 83,
      "comment": "Good implementation quality.",
      "status": "EVALUATED"
    }
  ]
}
```

### How Frontend Should Use This Response

- switch the screen to read-only mode
- disable all inputs
- hide Save Draft button
- hide or disable Submit button
- display `submittedAt`
- keep `submittedStudents` in local state if needed for confirmation UI

## Submit Common Error Cases

### 400: one or more students missing scores

Example message:

```json
{
  "message": "All students must be evaluated before submit. Missing studentUserIds: 4c4c8e56-09f8-45e0-bb7f-b99190ab70be",
  "error": "Bad Request",
  "statusCode": 400
}
```

Frontend handling:

- do not show generic error only
- parse the message
- highlight missing students in the UI

### 400: already submitted

Example message:

```json
{
  "message": "Evaluator evaluation has already been submitted",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 404: no draft exists yet

Example message:

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
export type EvaluationStage = 'CAPSTONE_I';

export interface EvaluatorDraftStudentInput {
  studentUserId: string;
  score: number;
  comment?: string;
}

export interface SaveEvaluatorDraftRequest {
  students: EvaluatorDraftStudentInput[];
}

export interface EvaluatorEvaluationSummary {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
  totalStudents: number;
  studentsEvaluated: number;
  studentsPendingEvaluation: number;
  averageScoreGiven: number;
  lastSavedAt: string | null;
  submittedAt: string | null;
}

export interface SavedOrSubmittedStudent {
  studentUserId: string;
  score: number;
  comment: string | null;
  status: 'EVALUATED';
}

export interface SaveEvaluatorDraftResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: EvaluatorEvaluationSummary;
  savedStudents: SavedOrSubmittedStudent[];
}

export interface SubmitEvaluatorEvaluationResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: EvaluatorEvaluationSummary;
  submittedStudents: SavedOrSubmittedStudent[];
}
```

## Minimal Frontend API Examples

```ts
export async function saveEvaluatorDraft(
  projectId: string,
  token: string,
  body: SaveEvaluatorDraftRequest
): Promise<SaveEvaluatorDraftResponse> {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/projects/${projectId}/draft?stage=CAPSTONE_I`,
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

export async function submitEvaluatorEvaluation(
  projectId: string,
  token: string
): Promise<SubmitEvaluatorEvaluationResponse> {
  const response = await fetch(
    `/api/v1/project-evaluations/evaluators/me/projects/${projectId}/submit?stage=CAPSTONE_I`,
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

- show Save Draft button at all times until submit succeeds
- autosave optional, but debounce it
- disable Submit unless all students have scores locally
- after successful submit, refetch project detail or trust the submit response and lock the form
- if backend returns `Submitted evaluator evaluation cannot be edited`, force refresh and switch to read-only mode

## Practical Integration Summary

- Use project detail endpoint to render the page.
- Use draft endpoint for partial saves.
- Use submit endpoint only after every student is scored.
- Treat submit as final and irreversible from the evaluator UI.
- After submit, render the evaluation as read-only.