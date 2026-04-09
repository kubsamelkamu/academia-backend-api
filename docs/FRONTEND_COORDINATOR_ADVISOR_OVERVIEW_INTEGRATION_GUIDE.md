# Frontend Coordinator Advisor Overview Integration Guide

This guide explains how the frontend should integrate the advisor overview analytics endpoint for coordinator and department head dashboards.

It covers:

- advisor overview summary cards
- advisor list rendering
- advisor project drill-down rendering
- milestone progress interpretation
- project group member rendering
- query parameters for filtering and pagination

## Goal

The advisor overview dashboard should allow department staff to:

1. see department-wide advisor summary metrics
2. list advisors in the department
3. inspect each advisor's assigned projects
4. inspect milestone progress per project
5. inspect each advised project's group details and members

This endpoint is a read-only analytics endpoint intended for coordinator and department head users.

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <token>`
- Allowed roles: `Coordinator`, `DepartmentHead`

Global success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-06T22:33:11.080Z"
}
```

## 1) Main endpoint

Use this endpoint for the advisor overview dashboard:

- `GET /api/v1/analytics/advisors/overview`

## 2) Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `departmentId` | `string` | No | Defaults to the authenticated user's department |
| `startDate` | `string` | No | Filter records from this created date, ISO 8601 |
| `endDate` | `string` | No | Filter records up to this updated date, ISO 8601 |
| `search` | `string` | No | Search advisors by first name, last name, or email |
| `page` | `number` | No | Page number, default `1` |
| `limit` | `number` | No | Page size, default `10` |
| `projectStatus` | `ACTIVE \| COMPLETED \| CANCELLED` | No | Filter advisor projects by project status |

## 3) Example request

```http
GET /api/v1/analytics/advisors/overview?departmentId=5d8cb816-0592-4a7c-9c01-8f62f7b9f9bc&page=1&limit=10
Authorization: Bearer <access-token>
```

## 4) Response structure

The API response contains these top-level objects inside `data`:

1. `departmentId`
2. `generatedAt`
3. `summary`
4. `pagination`
5. `filters`
6. `advisors`

## 5) Summary section

`summary` contains department-wide advisor and project metrics.

Fields:

- `totalAdvisors`
- `totalProjects`
- `assignedProjects`
- `unassignedProjects`
- `overallDepartmentProjectProgress`
- `projectStatusCounts`

Example:

```json
{
  "totalAdvisors": 2,
  "totalProjects": 3,
  "assignedProjects": 3,
  "unassignedProjects": 0,
  "overallDepartmentProjectProgress": 40,
  "projectStatusCounts": {
    "ACTIVE": 3,
    "COMPLETED": 0,
    "CANCELLED": 0
  }
}
```

### Recommended use

Use this section for summary cards:

1. total advisors
2. total projects
3. assigned projects
4. unassigned projects
5. overall progress

## 6) Pagination section

`pagination` describes the returned page of advisors.

Fields:

- `page`
- `limit`
- `totalItems`
- `totalPages`
- `hasNextPage`
- `hasPreviousPage`

Use this to render pagination controls on the advisor list.

## 7) Filters section

`filters` echoes the effective filter values.

Fields:

- `search`
- `projectStatus`
- `startDate`
- `endDate`

Use this if the frontend wants to show active filter chips or preserve filter state.

## 8) Advisors list

`advisors` is the main collection for the page.

Each advisor item contains:

- `advisorProfileId`
- `advisorId`
- `firstName`
- `lastName`
- `fullName`
- `email`
- `avatarUrl`
- `status`
- `loadLimit`
- `currentLoad`
- `availableCapacity`
- `metrics`
- `projects`

### Important ID rule

- `advisorProfileId` is the advisor profile record id
- `advisorId` is the actual user id

If another endpoint expects advisor user id, use `advisorId`, not `advisorProfileId`.

## 9) Advisor metrics

Each advisor has a `metrics` object.

Fields:

- `totalProjectsAdvising`
- `activeProjectsCount`
- `completedProjectsCount`
- `cancelledProjectsCount`
- `overallProjectProgress`

Example:

```json
{
  "totalProjectsAdvising": 3,
  "activeProjectsCount": 3,
  "completedProjectsCount": 0,
  "cancelledProjectsCount": 0,
  "overallProjectProgress": 40
}
```

### Recommended use

Render advisor-level KPIs in each advisor card or row:

1. active projects
2. total projects
3. progress percentage
4. available capacity

## 10) Projects under each advisor

Each advisor item contains a `projects` array.

Each project includes:

- `id`
- `title`
- `description`
- `status`
- `createdAt`
- `updatedAt`
- `advisor`
- `proposal`
- `progress`
- `milestones`
- `group`

This structure is suitable for an expandable advisor row, nested accordion, or advisor detail side panel.

## 11) Project progress

Each project contains a `progress` object.

Fields:

- `percentage`
- `approvedMilestones`
- `submittedMilestones`
- `rejectedMilestones`
- `pendingMilestones`
- `totalMilestones`

Example:

```json
{
  "percentage": 60,
  "approvedMilestones": 3,
  "submittedMilestones": 0,
  "rejectedMilestones": 0,
  "pendingMilestones": 2,
  "totalMilestones": 5
}
```

### Interpretation rule

`percentage` represents milestone completion progress for the project.

Recommended progress bar calculation on the frontend:

- use the `percentage` provided by backend directly
- do not recompute unless the frontend is explicitly building fallback logic

## 12) Milestones list

Each project contains `milestones`.

Each milestone contains:

- `id`
- `title`
- `description`
- `status`
- `dueDate`
- `submittedAt`
- `feedback`
- `createdAt`
- `updatedAt`

### Recommended use

Render milestone rows under each project with:

1. milestone title
2. status badge
3. due date
4. submitted date when available

### Suggested milestone badges

- `APPROVED`: green
- `SUBMITTED`: blue or warning-neutral
- `PENDING`: gray
- `REJECTED`: red

## 13) Group details

Each project may include a `group` object.

Fields:

- `id`
- `name`
- `status`
- `objectives`
- `technologies`
- `leader`
- `members`
- `totalMembers`

### Recommended use

Render this in a project detail panel or expandable block.

Important fields for display:

1. group name
2. objectives
3. technologies
4. leader details
5. member list

## 14) Group leader and members

### Leader

`group.leader` contains:

- `id`
- `firstName`
- `lastName`
- `fullName`
- `email`
- `avatarUrl`
- `studentProfile`

### Members

Each item in `group.members` contains:

- `id`
- `firstName`
- `lastName`
- `fullName`
- `email`
- `avatarUrl`
- `studentProfile`

### Student profile

`studentProfile` can be `null` or contain:

- `id`
- `bio`
- `githubUrl`
- `linkedinUrl`
- `portfolioUrl`
- `techStack`

### Recommended rendering

For group members show:

1. avatar
2. full name
3. email
4. optionally tech stack if student profile exists

## 15) Handling advisors with no projects

An advisor can appear with:

- valid advisor profile fields
- `metrics.totalProjectsAdvising = 0`
- `projects = []`

Example from your data:

```json
{
  "advisorProfileId": "42f696ba-6956-478b-9388-16b367d5c172",
  "advisorId": "4fed2707-11a3-4a51-b9f1-d69a91c02866",
  "fullName": "Advisor One",
  "metrics": {
    "totalProjectsAdvising": 0,
    "overallProjectProgress": 0
  },
  "projects": []
}
```

### Recommended frontend behavior

- still show the advisor row or card
- show `No assigned projects` in the detail section
- do not hide the advisor entirely

## 16) Suggested dashboard layout

### Top summary cards

Render cards for:

1. total advisors
2. total projects
3. assigned projects
4. unassigned projects
5. department progress

### Advisor list

Each advisor row or card should show:

1. avatar
2. full name
3. email
4. active project count
5. total project count
6. load or capacity
7. overall progress

### Expandable advisor detail

When expanded, show that advisor's projects with:

1. project title
2. progress bar
3. milestone counts
4. group info
5. group members

## 17) Recommended table columns

Suggested advisor table columns:

1. Advisor
2. Email
3. Status
4. Active Projects
5. Total Projects
6. Available Capacity
7. Overall Progress
8. Actions

Suggested project subtable columns:

1. Project
2. Status
3. Progress
4. Group
5. Members
6. Milestones

## 18) Frontend TypeScript shape

```ts
export interface AdvisorOverviewResponse {
  departmentId: string;
  generatedAt: string;
  summary: {
    totalAdvisors: number;
    totalProjects: number;
    assignedProjects: number;
    unassignedProjects: number;
    overallDepartmentProjectProgress: number;
    projectStatusCounts: {
      ACTIVE: number;
      COMPLETED: number;
      CANCELLED: number;
    };
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: {
    search: string | null;
    projectStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | null;
    startDate: string | null;
    endDate: string | null;
  };
  advisors: AdvisorOverviewAdvisor[];
}

export interface AdvisorOverviewAdvisor {
  advisorProfileId: string;
  advisorId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  loadLimit: number;
  currentLoad: number;
  availableCapacity: number;
  metrics: {
    totalProjectsAdvising: number;
    activeProjectsCount: number;
    completedProjectsCount: number;
    cancelledProjectsCount: number;
    overallProjectProgress: number;
  };
  projects: AdvisorOverviewProject[];
}

export interface AdvisorOverviewProject {
  id: string;
  title: string;
  description: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  progress: {
    percentage: number;
    approvedMilestones: number;
    submittedMilestones: number;
    rejectedMilestones: number;
    pendingMilestones: number;
    totalMilestones: number;
  };
  milestones: AdvisorOverviewMilestone[];
  group: AdvisorOverviewGroup | null;
}
```

## 19) Recommended frontend fetch example

```ts
export async function fetchAdvisorOverview(params: {
  token: string;
  departmentId?: string;
  search?: string;
  page?: number;
  limit?: number;
  projectStatus?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}) {
  const query = new URLSearchParams();

  if (params.departmentId) query.set('departmentId', params.departmentId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.projectStatus) query.set('projectStatus', params.projectStatus);

  const response = await fetch(`/api/v1/analytics/advisors/overview?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load advisor overview');
  }

  return response.json();
}
```

## 20) Suggested UI behavior for filters

### Search

Use `search` to filter by:

- advisor first name
- advisor last name
- advisor email

This is advisor-level search, not project title search.

### Project status

Use `projectStatus` when the frontend wants to inspect only advisors' projects that match a given project state.

Example:

- show only active projects across advisors
- show only completed projects for reporting

## 21) Empty states

### No advisors returned

Show:

- `No advisors found for this department or filter`

### Advisor exists but has no projects

Show:

- advisor card remains visible
- nested message: `No assigned projects`

### Group profile data missing

If `studentProfile` is `null`, do not render profile links or tech stack sections.

## 22) Final frontend rules

Do:

- use `summary` for top dashboard metrics
- use `advisors` for paginated advisor rows
- use `metrics.overallProjectProgress` for advisor-level progress indicators
- use `project.progress.percentage` for project progress indicators
- use `group.totalMembers` instead of recounting when possible

Do not:

- treat `advisorProfileId` as the same as `advisorId`
- assume every advisor has assigned projects
- assume every student has a populated `studentProfile`
- recompute pagination from the array length alone

## 23) Acceptance criteria

Frontend integration is correct when:

1. summary cards render from `summary`
2. advisor list renders from `advisors`
3. pagination uses `pagination`
4. filters preserve UI state from `filters`
5. advisor project detail expands correctly
6. project milestone progress renders correctly
7. group leader and members display correctly
8. empty advisor and empty project states are handled gracefully