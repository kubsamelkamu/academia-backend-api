# Frontend Advisor Project Evaluation Capstone II Integration Guide

This guide explains how to integrate these advisor endpoints from your frontend for the Capstone II workflow:

- `GET /api/v1/project-evaluations/advisors/me/dashboard`
- `GET /api/v1/project-evaluations/advisors/me/projects/{projectId}`
- `POST /api/v1/project-evaluations/advisors/me/projects/{projectId}/draft`
- `POST /api/v1/project-evaluations/advisors/me/projects/{projectId}/submit`

The goal is clear frontend integration for the advisor scoring workflow, including response shapes, request bodies, UI state handling, and the exact rules the backend enforces.

## Scope

This guide is for the advisor evaluation flow for:

- `CAPSTONE_II`
- logged-in advisor user
- projects assigned to that advisor
- student scoring and final advisor submission for the project group

Important:

- These endpoints require a valid advisor JWT access token.
- The backend now supports both `CAPSTONE_I` and `CAPSTONE_II`, but this guide is specifically for `CAPSTONE_II` integration.
- The data contract is the same pattern as Capstone I. The main frontend change is using `stage=CAPSTONE_II`.
- Draft save is partial. You can save one student, some students, or all students.
- Submit does not take a request body.
- Submit succeeds only when every active or pending student in the project group already has a saved score.
- After submit, the advisor evaluation becomes read-only and further draft saves are rejected.

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

### Step 1: Load advisor dashboard

Use:

- `GET /api/v1/project-evaluations/advisors/me/dashboard?stage=CAPSTONE_II`

Use the dashboard to:

- list all advised project groups
- show advisor progress for each group
- show milestone progress for each group
- decide which primary action to show

### Step 2: Open one project detail page

Use:

- `GET /api/v1/project-evaluations/advisors/me/projects/{projectId}?stage=CAPSTONE_II`

Use the detail response to:

- render the group members
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
- do not force the advisor to score all students before saving draft

### Step 4: Save draft while the advisor is working

Use:

- `POST /api/v1/project-evaluations/advisors/me/projects/{projectId}/draft?stage=CAPSTONE_II`

Use this whenever the advisor clicks Save Draft or when you autosave.

### Step 5: Submit only after all students are scored

Use:

- `POST /api/v1/project-evaluations/advisors/me/projects/{projectId}/submit?stage=CAPSTONE_II`

Enable Submit only when every student shown in project detail has a valid score.

## Common Status Values You Should Use in Frontend

### Advisor Evaluation Status

- `NOT_STARTED`
- `IN_PROGRESS`
- `SUBMITTED`

### Student Evaluation Status

- `PENDING`
- `EVALUATED`

### Dashboard Next Action

- `START_EVALUATION`
- `COMPLETE_STUDENT_EVALUATION`
- `VIEW_SUBMITTED_EVALUATION`

## Endpoint 1: Advisor Dashboard

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/advisors/me/dashboard?stage=CAPSTONE_II`
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
    "totalProjectGroups": 2,
    "totalStudents": 6,
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 3,
    "overallMilestoneProgressPercent": 66,
    "fullyEvaluatedProjectGroups": 1,
    "projectGroupsPendingEvaluation": 1
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
        "totalMembers": 3
      },
      "evaluation": {
        "stage": "CAPSTONE_II",
        "status": "IN_PROGRESS",
        "totalStudents": 3,
        "studentsEvaluated": 2,
        "studentsPendingEvaluation": 1,
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
      "nextAction": "COMPLETE_STUDENT_EVALUATION"
    }
  ]
}
```

### How Frontend Should Use Dashboard Response

- render dashboard summary cards using `summary`
- use `projectGroups` for the table or card list
- show status badge from `evaluation.status`
- show milestone progress for advisor context, not as an editable workflow state
- use `nextAction` to decide the primary CTA

Recommended mapping:

- `START_EVALUATION` -> open project detail in editable mode
- `COMPLETE_STUDENT_EVALUATION` -> open project detail in editable mode and highlight remaining students
- `VIEW_SUBMITTED_EVALUATION` -> open project detail in read-only mode

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

### 404: advisor profile missing

```json
{
  "message": "Advisor profile not found",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 2: Advisor Project Detail

### Request

- Method: `GET`
- URL: `/api/v1/project-evaluations/advisors/me/projects/{projectId}?stage=CAPSTONE_II`
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
  "group": {
    "id": "7f3ebc72-e5d5-44b4-8120-a55312f8a831",
    "name": "Group Beta",
    "status": "ACTIVE",
    "objectives": "Real-time indoor and outdoor routing for students.",
    "technologies": ["NestJS", "React", "PostgreSQL"],
    "totalMembers": 3,
    "leader": {
      "id": "d5d40de0-5726-4c94-b574-dcd53bd3f020",
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
      "status": "ACTIVE",
      "studentProfile": {
        "id": "student-profile-id-1",
        "bio": "Backend-focused student.",
        "githubUrl": "https://github.com/john",
        "linkedinUrl": "https://linkedin.com/in/john",
        "portfolioUrl": null,
        "techStack": ["NestJS", "Prisma"]
      },
      "evaluation": {
        "status": "EVALUATED",
        "score": 84.5,
        "comment": "Strong ownership and steady contribution.",
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
      "status": "ACTIVE",
      "studentProfile": {
        "id": "student-profile-id-2",
        "bio": null,
        "githubUrl": null,
        "linkedinUrl": null,
        "portfolioUrl": null,
        "techStack": ["React"]
      },
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

- render group and project metadata at the top of the page
- render student cards or rows using `students`
- prefill score and comment fields using `students[].evaluation`
- use `evaluation.status` to decide whether the page is editable
- render milestone context using `milestones` and `milestoneProgress`
- optionally surface approved submission files for advisor review context

Recommended UI behavior:

- if `evaluation.status === "NOT_STARTED"`, show empty scoring form
- if `evaluation.status === "IN_PROGRESS"`, show editable form with saved values
- if `evaluation.status === "SUBMITTED"`, show read-only form and hide Save Draft and Submit buttons

## Project Detail Common Error Cases

### 404: project not found for advisor

```json
{
  "message": "Project not found for this advisor",
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

## Endpoint 3: Save Advisor Draft

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/advisors/me/projects/{projectId}/draft?stage=CAPSTONE_II`
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
      "comment": "Strong ownership and steady contribution."
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good effort, but needs stronger technical explanation."
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
  "message": "Advisor evaluation draft saved successfully",
  "stage": "CAPSTONE_II",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "evaluation": {
    "status": "IN_PROGRESS",
    "totalStudents": 3,
    "studentsEvaluated": 2,
    "studentsPendingEvaluation": 1,
    "lastSavedAt": "2026-04-17T09:50:00.000Z",
    "submittedAt": null
  },
  "savedStudents": [
    {
      "studentUserId": "student-user-id-1",
      "score": 84.5,
      "comment": "Strong ownership and steady contribution.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good effort, but needs stronger technical explanation.",
      "status": "EVALUATED"
    }
  ]
}
```

### How Frontend Should Use This Response

- show success toast from `message`
- update the page summary from `evaluation`
- update last-saved timestamp from `evaluation.lastSavedAt`
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
  "message": "Submitted advisor evaluation cannot be edited",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 404: project not found for advisor

```json
{
  "message": "Project not found for this advisor",
  "error": "Not Found",
  "statusCode": 404
}
```

## Endpoint 4: Submit Advisor Evaluation

### Request

- Method: `POST`
- URL: `/api/v1/project-evaluations/advisors/me/projects/{projectId}/submit?stage=CAPSTONE_II`
- Headers:
  - `Authorization: Bearer <access_token>`

### Request Body

No request body is required.

Send an empty body or no body at all.

Example:

```http
POST /api/v1/project-evaluations/advisors/me/projects/5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e/submit?stage=CAPSTONE_II
Authorization: Bearer <access_token>
```

## Submit Success Response

Status code:

- `201 Created`

Response:

```json
{
  "message": "Advisor project evaluation submitted successfully.",
  "stage": "CAPSTONE_II",
  "projectId": "5f0f4d9d-1b5f-450d-ae95-cda8bb84ff7e",
  "evaluation": {
    "status": "SUBMITTED",
    "totalStudents": 3,
    "studentsEvaluated": 3,
    "studentsPendingEvaluation": 0,
    "lastSavedAt": "2026-04-17T09:58:00.000Z",
    "submittedAt": "2026-04-17T10:00:00.000Z"
  },
  "submittedStudents": [
    {
      "studentUserId": "student-user-id-1",
      "score": 84.5,
      "comment": "Strong ownership and steady contribution.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-2",
      "score": 79,
      "comment": "Good effort, but needs stronger technical explanation.",
      "status": "EVALUATED"
    },
    {
      "studentUserId": "student-user-id-3",
      "score": 88,
      "comment": "Very strong delivery and collaboration.",
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
- optionally keep `submittedStudents` in local state for confirmation UI

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
  "message": "Advisor evaluation draft not found",
  "error": "Not Found",
  "statusCode": 404
}
```

Frontend handling:

- first save at least one draft score before submit

## Minimal Frontend Types

```ts
export type EvaluationStage = 'CAPSTONE_II';

export type AdvisorEvaluationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export type AdvisorNextAction =
  | 'START_EVALUATION'
  | 'COMPLETE_STUDENT_EVALUATION'
  | 'VIEW_SUBMITTED_EVALUATION';

export type StudentEvaluationStatus = 'PENDING' | 'EVALUATED';

export interface SaveAdvisorDraftStudentInput {
  studentUserId: string;
  score: number;
  comment?: string;
}

export interface SaveAdvisorDraftRequest {
  students: SaveAdvisorDraftStudentInput[];
}

export interface AdvisorEvaluationSummary {
  stage: EvaluationStage;
  status: AdvisorEvaluationStatus;
  totalStudents: number;
  studentsEvaluated: number;
  studentsPendingEvaluation: number;
  lastSavedAt: string | null;
  submittedAt: string | null;
}

export interface AdvisorSavedStudent {
  studentUserId: string;
  score: number;
  comment: string | null;
  status: 'EVALUATED';
}

export interface AdvisorDashboardResponse {
  stage: EvaluationStage;
  generatedAt: string;
  summary: {
    totalProjectGroups: number;
    totalStudents: number;
    studentsEvaluated: number;
    studentsPendingEvaluation: number;
    overallMilestoneProgressPercent: number;
    fullyEvaluatedProjectGroups: number;
    projectGroupsPendingEvaluation: number;
  };
  projectGroups: Array<{
    projectId: string;
    projectTitle: string;
    projectStatus: string;
    group: {
      id: string;
      name: string;
      status: string;
      totalMembers: number;
    } | null;
    evaluation: AdvisorEvaluationSummary;
    milestones: {
      total: number;
      approved: number;
      submitted: number;
      pending: number;
      rejected: number;
      progressPercent: number;
    };
    nextAction: AdvisorNextAction;
  }>;
}

export interface SaveAdvisorDraftResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: Omit<AdvisorEvaluationSummary, 'stage'>;
  savedStudents: AdvisorSavedStudent[];
}

export interface SubmitAdvisorEvaluationResponse {
  message: string;
  stage: EvaluationStage;
  projectId: string;
  evaluation: Omit<AdvisorEvaluationSummary, 'stage'>;
  submittedStudents: AdvisorSavedStudent[];
}
```

## Minimal Frontend API Examples

```ts
export async function getAdvisorDashboard(token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/advisors/me/dashboard?stage=CAPSTONE_II`,
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

export async function getAdvisorProjectDetail(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/advisors/me/projects/${projectId}?stage=CAPSTONE_II`,
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

export async function saveAdvisorDraft(
  projectId: string,
  token: string,
  body: SaveAdvisorDraftRequest
) {
  const response = await fetch(
    `/api/v1/project-evaluations/advisors/me/projects/${projectId}/draft?stage=CAPSTONE_II`,
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

export async function submitAdvisorEvaluation(projectId: string, token: string) {
  const response = await fetch(
    `/api/v1/project-evaluations/advisors/me/projects/${projectId}/submit?stage=CAPSTONE_II`,
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
- if backend returns `Submitted advisor evaluation cannot be edited`, refresh detail and lock the screen immediately
- treat milestone data as context for review, not as editable data in this screen

## Practical Integration Summary

- Use dashboard to list advised Capstone II projects and advisor progress.
- Use project detail to render the scoring page and prefill saved values.
- Use draft to save partial progress for one or many students.
- Use submit only after every student has been scored.
- After submit, render the advisor evaluation as read-only.