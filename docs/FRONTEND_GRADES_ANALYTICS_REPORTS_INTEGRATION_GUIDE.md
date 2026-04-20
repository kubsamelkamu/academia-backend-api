# Frontend Grades Analytics And Reports Integration Guide

This guide explains how to integrate the new grades analytics and report download endpoints for coordinator and department-head dashboards.

It covers:

- stage overview analytics
- project-level grades drilldown
- student-level grades drilldown
- CSV, Excel, and PDF report downloads
- frontend filter handling
- dashboard and table rendering recommendations

## Scope

This guide is for:

- `COORDINATOR`
- `DEPARTMENT_HEAD`
- `CAPSTONE_I` and `CAPSTONE_II`
- read-only analytics dashboards
- downloadable report exports

Important:

- All endpoints require a valid JWT access token.
- All endpoints default to the authenticated user's department when `departmentId` is not provided.
- Only `CAPSTONE_I` and `CAPSTONE_II` are supported.
- The analytics endpoints return JSON data for dashboard rendering.
- The report endpoint returns a file download, not JSON.

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <access_token>`

This backend commonly wraps JSON responses like this:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-20T10:00:00.000Z"
}
```

In the examples below, the payloads show the inner `data` object for readability.

## Endpoints

Use these endpoints together:

- `GET /api/v1/analytics/grades/overview`
- `GET /api/v1/analytics/grades/projects`
- `GET /api/v1/analytics/grades/students`
- `GET /api/v1/reports/grades/:format`

Supported report formats:

- `csv`
- `excel`
- `pdf`

Supported report scopes:

- `projects`
- `students`

## Recommended Frontend Flow

### Step 1: Load overview cards first

Call:

- `GET /api/v1/analytics/grades/overview?stage=CAPSTONE_I`

or:

- `GET /api/v1/analytics/grades/overview?stage=CAPSTONE_II`

Use this response for:

- summary cards
- pipeline status counts
- review counts
- grade distribution charts

### Step 2: Load project drilldown table

Call:

- `GET /api/v1/analytics/grades/projects?stage=CAPSTONE_I&page=1&limit=20`

Use this response for:

- project rows
- aggregation workflow table
- project-level filtering
- export state for `scope=projects`

### Step 3: Load student drilldown table

Call:

- `GET /api/v1/analytics/grades/students?stage=CAPSTONE_I&page=1&limit=20`

Use this response for:

- student rows
- final grade table
- grade distribution lists
- export state for `scope=students`

### Step 4: Download filtered report files

Call:

- `GET /api/v1/reports/grades/csv?...`
- `GET /api/v1/reports/grades/excel?...`
- `GET /api/v1/reports/grades/pdf?...`

Pass the same filters already active in the table UI so the file matches what the user is viewing.

## 1) Overview Endpoint

### Request

- Method: `GET`
- URL: `/api/v1/analytics/grades/overview?stage=CAPSTONE_I`

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `stage` | `CAPSTONE_I \| CAPSTONE_II` | Yes | Target evaluation stage |
| `departmentId` | `string` | No | Defaults to authenticated user's department |

### Example Request

```http
GET /api/v1/analytics/grades/overview?stage=CAPSTONE_II
Authorization: Bearer <access_token>
```

### Success Response

```json
{
  "stage": "CAPSTONE_II",
  "departmentId": "department-uuid",
  "generatedAt": "2026-04-20T11:00:00.000Z",
  "weights": {
    "isConfigured": true,
    "advisorPercentage": 40,
    "evaluatorPercentage": 60,
    "updatedAt": "2026-04-19T08:15:00.000Z"
  },
  "pipeline": {
    "totalProjectGroups": 12,
    "waitingForWeightsCount": 0,
    "waitingForAdvisorCount": 2,
    "waitingForEvaluatorsCount": 3,
    "readyForAggregationCount": 1,
    "finalizedPendingApprovalCount": 2,
    "approvedCount": 3,
    "rejectedCount": 1
  },
  "review": {
    "pendingReviewCount": 2,
    "approvedCount": 3,
    "rejectedCount": 1,
    "approvalRatePercent": 50
  },
  "grades": {
    "totalFinalizedStudents": 18,
    "totalPublishedStudents": 12,
    "averageFinalGrade": 78.44,
    "highestFinalGrade": 92,
    "lowestFinalGrade": 51
  },
  "distributions": {
    "letterGrades": {
      "A+": 1,
      "A": 2,
      "A-": 4,
      "B+": 3,
      "B": 2,
      "B-": 2,
      "C+": 2,
      "C": 1,
      "C-": 0,
      "D": 1,
      "F": 0
    },
    "scoreBands": [
      { "label": "0-39.99", "count": 0 },
      { "label": "40-49.99", "count": 0 },
      { "label": "50-59.99", "count": 2 },
      { "label": "60-69.99", "count": 3 },
      { "label": "70-79.99", "count": 4 },
      { "label": "80-89.99", "count": 7 },
      { "label": "90-100", "count": 2 }
    ]
  }
}
```

### Frontend Use

Use `weights` for a grading configuration banner.

Use `pipeline` for cards like:

1. waiting for advisor
2. waiting for evaluators
3. ready for aggregation
4. pending department-head review

Use `review` for approval/rejection summary cards.

Use `grades` and `distributions` for charts.

## 2) Project Drilldown Endpoint

### Request

- Method: `GET`
- URL: `/api/v1/analytics/grades/projects`

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `stage` | `CAPSTONE_I \| CAPSTONE_II` | Yes | Target evaluation stage |
| `departmentId` | `string` | No | Defaults to authenticated user's department |
| `search` | `string` | No | Search by project title, group name, or advisor identity |
| `projectStatus` | `ACTIVE \| COMPLETED \| CANCELLED` | No | Project status filter |
| `aggregationStatus` | `WAITING_FOR_WEIGHTS \| WAITING_FOR_ADVISOR \| WAITING_FOR_EVALUATORS \| READY_FOR_AGGREGATION` | No | Computed aggregation filter |
| `finalizationStatus` | `NOT_FINALIZED \| FINALIZED_PENDING_DEPARTMENT_HEAD \| APPROVED \| REJECTED` | No | Finalization filter |
| `page` | `number` | No | Default `1` |
| `limit` | `number` | No | Default `20`, max `100` |

### Example Request

```http
GET /api/v1/analytics/grades/projects?stage=CAPSTONE_I&aggregationStatus=READY_FOR_AGGREGATION&finalizationStatus=NOT_FINALIZED&page=1&limit=20
Authorization: Bearer <access_token>
```

### Success Response

```json
{
  "stage": "CAPSTONE_I",
  "departmentId": "department-uuid",
  "generatedAt": "2026-04-20T11:10:00.000Z",
  "weights": {
    "isConfigured": true,
    "advisorPercentage": 40,
    "evaluatorPercentage": 60,
    "updatedAt": "2026-04-19T08:15:00.000Z"
  },
  "summary": {
    "totalProjectGroups": 8,
    "waitingForWeightsCount": 0,
    "waitingForAdvisorCount": 1,
    "waitingForEvaluatorsCount": 2,
    "readyForAggregationCount": 1,
    "notFinalizedCount": 4,
    "finalizedPendingApprovalCount": 2,
    "approvedCount": 1,
    "rejectedCount": 1
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 8,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "filters": {
    "search": null,
    "projectStatus": null,
    "aggregationStatus": "READY_FOR_AGGREGATION",
    "finalizationStatus": "NOT_FINALIZED"
  },
  "items": [
    {
      "projectId": "project-uuid",
      "projectTitle": "Smart Campus Navigation",
      "projectStatus": "ACTIVE",
      "createdAt": "2026-03-01T09:00:00.000Z",
      "advisor": {
        "userId": "advisor-user-id",
        "fullName": "Helen Smith",
        "email": "helen@example.com"
      },
      "group": {
        "id": "group-uuid",
        "name": "Group Beta",
        "status": "ACTIVE",
        "totalMembers": 3
      },
      "aggregationStatus": "READY_FOR_AGGREGATION",
      "finalizationStatus": "NOT_FINALIZED",
      "progress": {
        "advisorSubmitted": true,
        "assignedEvaluatorsCount": 2,
        "submittedEvaluatorsCount": 2
      },
      "finalResult": null
    }
  ]
}
```

### Frontend Use

Use this endpoint for the main project table.

Recommended columns:

1. project title
2. advisor
3. group
4. aggregation status
5. finalization status
6. evaluator progress
7. average final grade when available

Recommended row UI rules:

- If `finalResult` is `null`, show placeholders for grade metrics.
- If `progress.advisorSubmitted` is `false`, highlight that advisor scoring is incomplete.
- If `aggregationStatus === "READY_FOR_AGGREGATION"` and `finalizationStatus === "NOT_FINALIZED"`, treat the row as ready for coordinator action.

## 3) Student Drilldown Endpoint

### Request

- Method: `GET`
- URL: `/api/v1/analytics/grades/students`

### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `stage` | `CAPSTONE_I \| CAPSTONE_II` | Yes | Target evaluation stage |
| `departmentId` | `string` | No | Defaults to authenticated user's department |
| `search` | `string` | No | Search by student name, email, project title, or group name |
| `finalizationStatus` | `FINALIZED_PENDING_DEPARTMENT_HEAD \| APPROVED \| REJECTED` | No | Final result status filter |
| `letterGrade` | `string` | No | Example `A-` |
| `minFinalGrade` | `number` | No | Min numeric grade |
| `maxFinalGrade` | `number` | No | Max numeric grade |
| `page` | `number` | No | Default `1` |
| `limit` | `number` | No | Default `20`, max `100` |

### Example Request

```http
GET /api/v1/analytics/grades/students?stage=CAPSTONE_II&letterGrade=A-&minFinalGrade=80&page=1&limit=20
Authorization: Bearer <access_token>
```

### Success Response

```json
{
  "stage": "CAPSTONE_II",
  "departmentId": "department-uuid",
  "generatedAt": "2026-04-20T11:15:00.000Z",
  "summary": {
    "approvedCount": 12,
    "pendingApprovalCount": 4,
    "rejectedCount": 2,
    "totalStudents": 18,
    "averageFinalGrade": 78.44,
    "highestFinalGrade": 92,
    "lowestFinalGrade": 51,
    "letterGradeCounts": {
      "A+": 1,
      "A": 2,
      "A-": 4,
      "B+": 3,
      "B": 2,
      "B-": 2,
      "C+": 2,
      "C": 1,
      "C-": 0,
      "D": 1,
      "F": 0
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 18,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "filters": {
    "search": null,
    "finalizationStatus": null,
    "letterGrade": "A-",
    "minFinalGrade": 80,
    "maxFinalGrade": null
  },
  "items": [
    {
      "finalResultScoreId": "score-uuid",
      "finalResultId": "final-result-uuid",
      "student": {
        "userId": "student-user-id",
        "fullName": "John Doe",
        "email": "john@example.com",
        "status": "ACTIVE"
      },
      "project": {
        "id": "project-uuid",
        "title": "Smart Campus Navigation",
        "status": "ACTIVE"
      },
      "group": {
        "id": "group-uuid",
        "name": "Group Beta",
        "status": "ACTIVE"
      },
      "finalizationStatus": "APPROVED",
      "isPublished": true,
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
      "finalizedAt": "2026-04-17T10:42:00.000Z",
      "publishedAt": "2026-04-17T11:10:00.000Z",
      "rejectedAt": null
    }
  ]
}
```

### Frontend Use

Use this endpoint for a detailed student grades table.

Recommended columns:

1. student name
2. project title
3. finalization status
4. published flag
5. advisor score
6. evaluator average score
7. final grade
8. letter grade

Recommended filter chips:

1. approved
2. pending approval
3. rejected
4. letter grade
5. min and max numeric grade

## 4) Report Download Endpoint

### Request

- Method: `GET`
- URL: `/api/v1/reports/grades/:format`

### Path Parameters

| Name | Values |
| --- | --- |
| `format` | `csv`, `excel`, `pdf` |

### Shared Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `stage` | `CAPSTONE_I \| CAPSTONE_II` | Yes | Target evaluation stage |
| `scope` | `projects \| students` | No | Defaults to `projects` |
| `departmentId` | `string` | No | Defaults to authenticated user's department |
| `search` | `string` | No | Shared search filter |
| `projectStatus` | `ACTIVE \| COMPLETED \| CANCELLED` | No | Project-scope only |
| `aggregationStatus` | `WAITING_FOR_WEIGHTS \| WAITING_FOR_ADVISOR \| WAITING_FOR_EVALUATORS \| READY_FOR_AGGREGATION` | No | Project-scope only |
| `finalizationStatus` | `NOT_FINALIZED \| FINALIZED_PENDING_DEPARTMENT_HEAD \| APPROVED \| REJECTED` | No | Project-scope; for student scope use real final-result statuses only |
| `letterGrade` | `string` | No | Student-scope only |
| `minFinalGrade` | `number` | No | Student-scope only |
| `maxFinalGrade` | `number` | No | Student-scope only |

### Example Requests

Project CSV:

```http
GET /api/v1/reports/grades/csv?stage=CAPSTONE_I&scope=projects&aggregationStatus=READY_FOR_AGGREGATION
Authorization: Bearer <access_token>
```

Student Excel:

```http
GET /api/v1/reports/grades/excel?stage=CAPSTONE_II&scope=students&letterGrade=A-&minFinalGrade=80
Authorization: Bearer <access_token>
```

Project PDF:

```http
GET /api/v1/reports/grades/pdf?stage=CAPSTONE_II&scope=projects&finalizationStatus=APPROVED
Authorization: Bearer <access_token>
```

### Download Behavior

The backend responds with file content and headers like:

- `Content-Type: text/csv`
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Type: application/pdf`

Expected filenames:

- `grades-projects-report.csv`
- `grades-projects-report.xlsx`
- `grades-projects-report.pdf`
- `grades-students-report.csv`
- `grades-students-report.xlsx`
- `grades-students-report.pdf`

### Frontend Download Example

```ts
export async function downloadGradesReport(params: {
  token: string;
  format: 'csv' | 'excel' | 'pdf';
  stage: 'CAPSTONE_I' | 'CAPSTONE_II';
  scope: 'projects' | 'students';
  query?: Record<string, string | number | undefined | null>;
}) {
  const search = new URLSearchParams();
  search.set('stage', params.stage);
  search.set('scope', params.scope);

  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value));
    }
  }

  const response = await fetch(`/api/v1/reports/grades/${params.format}?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });

  if (!response.ok) {
    throw await response.json();
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = '';
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
```

## Recommended Frontend State Model

```ts
export type GradesStage = 'CAPSTONE_I' | 'CAPSTONE_II';

export type AggregationStatus =
  | 'WAITING_FOR_WEIGHTS'
  | 'WAITING_FOR_ADVISOR'
  | 'WAITING_FOR_EVALUATORS'
  | 'READY_FOR_AGGREGATION';

export type ProjectFinalizationStatus =
  | 'NOT_FINALIZED'
  | 'FINALIZED_PENDING_DEPARTMENT_HEAD'
  | 'APPROVED'
  | 'REJECTED';
```

Recommended page state:

1. selected stage
2. overview payload
3. active tab: projects or students
4. project filters
5. student filters
6. pagination state per tab
7. export-in-progress state per format

## Error Handling

### Common Validation Errors

Unsupported stage:

```json
{
  "message": "Only CAPSTONE_I and CAPSTONE_II are supported for now",
  "error": "Bad Request",
  "statusCode": 400
}
```

Invalid range:

```json
{
  "message": "minFinalGrade cannot be greater than maxFinalGrade",
  "error": "Bad Request",
  "statusCode": 400
}
```

Missing stage for reports:

```json
{
  "message": "stage is required for grades reports",
  "error": "Bad Request",
  "statusCode": 400
}
```

### Frontend Handling Rules

- Keep the currently selected stage visible in the error UI.
- Do not clear table rows until replacement data arrives successfully.
- Reuse current filters for retry.
- Show download errors inline near the export buttons.

## Recommended UI Layout

Use this page structure:

1. stage switcher
2. weights banner
3. overview cards
4. charts section
5. projects or students tab switcher
6. filter bar for current tab
7. data table
8. export buttons matching the active tab filters

Recommended export buttons:

1. Download CSV
2. Download Excel
3. Download PDF

Disable export buttons while the current download is in progress.

## Practical Summary

- Use `overview` for cards and charts.
- Use `projects` for coordinator workflow visibility by project.
- Use `students` for final grade visibility by student.
- Always pass the active stage explicitly.
- Reuse active filters when calling the report download endpoint so exports match the visible data.