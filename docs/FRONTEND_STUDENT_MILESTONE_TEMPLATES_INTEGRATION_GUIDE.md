# Frontend Student Milestone Templates Integration Guide

This guide explains, step-by-step, how to show **created milestone templates** in the **Student Dashboard** and how to combine them with project milestones.

## Scope

- Show students the department’s active milestone templates.
- Show students their project milestones (if project milestones already exist).
- Handle current backend limitations safely in frontend UX.

---

## 1) Base URL and auth

- API base (dev): `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`
- Auth header for all requests:
  - `Authorization: Bearer <accessToken>`

Global success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-03-19T12:00:00.000Z"
}
```

---

## 2) What backend supports right now

### Already available

1. Student can list milestone templates in their department:
   - `GET /departments/:departmentId/milestone-templates`
2. Student can view projects and milestones:
   - `GET /projects?departmentId=:departmentId&studentId=:studentUserId`
   - `GET /projects/:projectId`
   - `GET /projects/:projectId/milestones`

### Important current limitation

- Creating a template does **not** automatically create milestones inside student projects yet.
- So in dashboard:
  - Templates list can appear immediately.
  - Project milestone timeline appears only when project milestone records exist.

---

## 3) Step-by-step frontend integration

## Step 1 — Get user context after login

From your auth state, keep:

- `user.id`
- `user.departmentId`
- `accessToken`

You need `departmentId` to load templates and projects.

## Step 2 — Load active templates for Student Dashboard

### Request

- `GET /departments/:departmentId/milestone-templates?isActive=true&page=1&limit=20`

### Expected `data` shape

```json
{
  "templates": [
    {
      "templateId": "tpl_001",
      "name": "Proposal Submission Template",
      "description": "Template for proposal stage",
      "milestones": [
        {
          "sequence": 1,
          "title": "Proposal Submission",
          "description": "Submit proposal document",
          "defaultDurationDays": 7,
          "hasDeliverable": true,
          "requiredDocuments": ["project_proposal.pdf"],
          "isRequired": true
        }
      ],
      "isActive": true,
      "createdAt": "2026-03-19T09:00:00.000Z",
      "usageCount": 5
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### UI recommendation

- Show a "Department Templates" section/card:
  - template name
  - milestone count
  - `usageCount`
  - first 1–2 milestone titles

## Step 3 — Load student project(s)

### Request

- `GET /projects?departmentId=:departmentId&studentId=:userId`

### UI usage

- If no project exists: show template catalog only.
- If one or more projects exist: show project cards and allow opening details.

## Step 4 — Load project milestones timeline

### Request

- `GET /projects/:projectId/milestones`

### Status values

- `PENDING`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`

### UI recommendation

For each milestone row/card, show:

- title
- due date
- status badge
- submitted date (if exists)
- feedback (if exists)

## Step 5 — Merge templates + project milestones for display

Use this simple rule:

1. If project milestones exist:
   - show project milestones as source of truth.
2. If project milestones do not exist:
   - show selected/department template milestones as a preview list with label:
   - `"Template available, milestones not assigned yet"`

---

## 4) Suggested dashboard sections (minimal)

1. **My Project**
   - active project title/status
2. **My Milestones**
   - project milestone timeline (if exists)
3. **Department Templates**
   - active templates (including newly created ones)

This keeps UX simple while backend rollout continues.

---

## 5) Error handling map

### `401 Unauthorized`

- Token expired/invalid.
- Action: refresh token or force login.

### `403 Forbidden`

- Most likely department mismatch or access rules.
- Action: verify student belongs to `departmentId` used in path/query.

### `404 Not Found`

- Project or template not found.
- Action: show empty state and refetch list.

### `400 Bad Request`

- Invalid query params.
- Action: sanitize pagination/filter values.

---

## 6) Realtime update behavior (recommended)

When a coordinator/head creates a new template:

1. Student receives in-app notification event: `MILESTONE_TEMPLATE_CREATED`.
2. On receiving it, frontend should refetch:
   - `GET /departments/:departmentId/milestone-templates?isActive=true`

This makes newly created templates appear instantly in dashboard.

---

## 7) Frontend data model (suggested)

```ts
type StudentMilestoneTemplate = {
  templateId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  usageCount: number;
  milestones: {
    sequence: number;
    title: string;
    description?: string;
    defaultDurationDays: number;
    hasDeliverable: boolean;
    requiredDocuments: string[];
    isRequired: boolean;
  }[];
};

type StudentProjectMilestone = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: string;
  feedback?: string;
};
```

---

## 8) Production-ready next step (backend enhancement)

To fully align template and student milestones automatically, add:

1. `milestoneTemplateId` on project creation input.
2. Template-to-project milestone generation in backend when project is created.
3. Student milestone submit endpoint with file upload.

Until those are added, showing templates + project milestones separately is the correct and safe frontend integration.

---

## 9) Quick implementation checklist

- [ ] Load active templates by department on dashboard load
- [ ] Load student project list and select active project
- [ ] Load project milestones timeline
- [ ] Show fallback when template exists but project milestones are missing
- [ ] Handle `401/403/404/400` with clear UI states
- [ ] Refetch templates on `MILESTONE_TEMPLATE_CREATED` notification
