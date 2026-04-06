# Frontend Coordinator Project Tracking Integration Guide

This guide describes how coordinators and department heads can retrieve department project tracking data, including project details, group details, milestone progress, milestone status list, and approved milestone submission files.

## Endpoint

- Method: `GET`
- URL: `/api/v1/analytics/projects/tracking`
- Auth: Bearer token required
- Roles: `Coordinator`, `DepartmentHead`

## Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `departmentId` | `string` | No | Defaults to the authenticated user's department |
| `search` | `string` | No | Searches by project title, group name, or advisor name |
| `projectStatus` | `ACTIVE \| COMPLETED \| CANCELLED` | No | Filters projects by status |
| `page` | `number` | No | Defaults to `1` |
| `limit` | `number` | No | Defaults to `20`, max `100` |

## Example Request

```http
GET /api/v1/analytics/projects/tracking?page=1&limit=10&search=attendance&projectStatus=ACTIVE
Authorization: Bearer <access-token>
```

## Response Shape

```json
{
  "departmentId": "3c2f0d3a-0d8e-4c1c-a2f3-111111111111",
  "generatedAt": "2026-04-07T10:00:00.000Z",
  "summary": {
    "totalProjects": 12,
    "activeProjects": 10,
    "completedProjects": 2,
    "cancelledProjects": 0
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 12,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "filters": {
    "search": "attendance",
    "projectStatus": "ACTIVE"
  },
  "items": [
    {
      "projectId": "2fd26738-7b7c-42f0-9f0d-111111111111",
      "projectTitle": "Smart Attendance System",
      "projectDescription": "Attendance automation for classrooms",
      "projectStatus": "ACTIVE",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z",
      "proposal": {
        "id": "33f16e32-04fd-4e16-b5b9-111111111111",
        "title": "Smart Attendance System"
      },
      "advisor": {
        "id": "f5f4c348-1989-4f03-b0d0-111111111111",
        "firstName": "Jane",
        "lastName": "Doe",
        "fullName": "Jane Doe",
        "email": "jane@example.com",
        "avatarUrl": null
      },
      "group": {
        "id": "4c0f95fb-7b10-4f1e-9d53-111111111111",
        "name": "Innovators",
        "status": "APPROVED",
        "objectives": "Build a smart attendance and analytics platform",
        "technologies": ["NestJS", "React", "PostgreSQL"],
        "leader": {
          "id": "4de57f6f-1f57-4e09-a90b-111111111111",
          "firstName": "John",
          "lastName": "Smith",
          "fullName": "John Smith",
          "email": "john@example.com",
          "avatarUrl": null,
          "status": "ACTIVE",
          "studentProfile": {
            "id": "b8d4d8ff-7e68-49c6-8f64-111111111111",
            "bio": null,
            "githubUrl": null,
            "linkedinUrl": null,
            "portfolioUrl": null,
            "techStack": null
          }
        },
        "members": [
          {
            "id": "90bf3536-2f45-40e8-bde7-111111111111",
            "firstName": "Mary",
            "lastName": "Brown",
            "fullName": "Mary Brown",
            "email": "mary@example.com",
            "avatarUrl": null,
            "status": "ACTIVE",
            "joinedAt": "2026-02-20T10:00:00.000Z",
            "studentProfile": {
              "id": "7495398e-4ad7-43f2-8c02-111111111111",
              "bio": null,
              "githubUrl": null,
              "linkedinUrl": null,
              "portfolioUrl": null,
              "techStack": null
            }
          }
        ],
        "totalMembers": 4
      },
      "milestoneProgress": {
        "percentage": 50,
        "approved": 2,
        "submitted": 1,
        "rejected": 0,
        "pending": 1,
        "total": 4
      },
      "milestones": [
        {
          "id": "7286acc7-3af0-4c38-9331-111111111111",
          "title": "Proposal",
          "description": "Submit and approve proposal",
          "status": "APPROVED",
          "dueDate": "2026-03-10T00:00:00.000Z",
          "submittedAt": "2026-03-09T12:00:00.000Z",
          "feedback": null,
          "createdAt": "2026-03-01T10:00:00.000Z",
          "updatedAt": "2026-03-10T09:00:00.000Z",
          "approvedSubmissionFile": {
            "submissionId": "a0d3a4cc-ea17-4f52-9a8e-111111111111",
            "fileName": "proposal.pdf",
            "mimeType": "application/pdf",
            "sizeBytes": 245760,
            "fileUrl": "https://res.cloudinary.com/example/raw/upload/v1/proposal.pdf",
            "filePublicId": "proposal-public-id",
            "resourceType": "raw",
            "approvedAt": "2026-03-10T09:00:00.000Z",
            "approvedBy": {
              "id": "f5f4c348-1989-4f03-b0d0-111111111111",
              "firstName": "Jane",
              "lastName": "Doe",
              "fullName": "Jane Doe",
              "email": "jane@example.com",
              "avatarUrl": null
            }
          }
        }
      ]
    }
  ]
}
```

## Frontend Notes

- Use `summary` to render top-level counters for project totals and status breakdown.
- Use `milestoneProgress.percentage` for progress bars.
- Use `group.objectives` to show the project group's goals.
- Use `milestones[].approvedSubmissionFile` when you want to show the final approved document for a milestone.
- `approvedSubmissionFile` can be `null` when no approved document exists yet.
- `advisor` can be `null` for unassigned projects.
- `group` can be `null` if a project is missing project-group linkage data.

## Suggested UI Sections

- Summary cards: total, active, completed, cancelled.
- Search and filter bar: search text, project status.
- Project table or cards: project title, group name, advisor, progress percentage.
- Expandable project detail: objectives, group members, milestone list, approved files.