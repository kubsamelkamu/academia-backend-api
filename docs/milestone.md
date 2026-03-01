# Milestone & Templates API (Frontend Integration)

This document covers the **Milestone Templates (schedule templates)** API and the related **Department Document Templates library**.

---

## 1) Base URL + Auth

- API base (dev): `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`

All endpoints here require **JWT auth**:

- Header: `Authorization: Bearer <accessToken>`

### Global success response wrapper

All successful responses use the global wrapper:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

---

## 2) Access rules (important)

### Department isolation

These endpoints are **department-scoped**:

- `:departmentId` **must match the authenticated user’s assigned department**.
- If a user is not assigned to a department or tries another department’s ID, the API returns `403`.

### Roles

**Milestone Templates**
- List: `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`
- Create/Update/Delete: `DEPARTMENT_HEAD`, `COORDINATOR`

**Department Document Templates (files like SRS/SDD)**
- List/Get: `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`
- Create/Update/Delete + file operations: `DEPARTMENT_HEAD`, `COORDINATOR`

---

# A) Milestone Templates (Schedule Templates)

## A1) List milestone templates

- **GET** `/departments/:departmentId/milestone-templates`
- **HTTP**: `200 OK`

Query params:
- `page` (number, default `1`)
- `limit` (number, default `10`)
- `isActive` (boolean, optional)
- `search` (string, optional; searches by template name)

Example:

`GET /departments/dep_123/milestone-templates?page=1&limit=10&isActive=true&search=standard`

Success (`data`):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "templates": [
      {
        "templateId": "tpl_123",
        "name": "Standard",
        "description": "Default departmental schedule",
        "milestones": [
          {
            "sequence": 1,
            "title": "Proposal",
            "description": "Submit proposal",
            "defaultDurationDays": 14,
            "hasDeliverable": true,
            "requiredDocuments": ["proposal.pdf"],
            "isRequired": true
          }
        ],
        "isActive": true,
        "createdAt": "2026-03-01T12:00:00.000Z",
        "usageCount": 3
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
  },
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

Common errors:
- `403` Access denied to department

---

## A2) Create milestone template

- **POST** `/departments/:departmentId/milestone-templates`
- **HTTP**: `201 Created`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Body:

```json
{
  "name": "Standard",
  "description": "Default departmental schedule",
  "isActive": true,
  "milestones": [
    {
      "sequence": 1,
      "title": "Proposal",
      "description": "Submit proposal",
      "defaultDurationDays": 14,
      "hasDeliverable": true,
      "requiredDocuments": ["proposal.pdf"],
      "isRequired": true
    },
    {
      "sequence": 2,
      "title": "SRS",
      "defaultDurationDays": 21,
      "hasDeliverable": true,
      "requiredDocuments": ["srs.docx"],
      "isRequired": true
    }
  ]
}
```

Notes:
- `milestones[].sequence` must be **unique** within the template.

Success (`data`):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "message": "Milestone template created successfully",
    "templateId": "tpl_123",
    "name": "Standard",
    "milestoneCount": 2,
    "createdAt": "2026-03-01T12:00:00.000Z"
  },
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

Common errors:
- `400` duplicate milestone sequences
- `403` access denied to department

### Notification emitted (in-app)

When a milestone template is created, the backend emits an **in-app notification** to **all users in the same tenant + department** (including the creator):

- `eventType`: `MILESTONE_TEMPLATE_CREATED`
- `severity`: `INFO`
- Delivery:
  - Persisted in the notifications DB table (available via `GET /notifications`)
  - Pushed in realtime over Socket.IO namespace: `/notifications`

Notification `metadata` shape:

```json
{
  "departmentId": "dep_123",
  "departmentName": "Computer Science",
  "templateId": "tpl_123",
  "templateName": "Standard",
  "milestoneCount": 2,
  "actorUserId": "user_123"
}
```

Realtime Socket.IO payload (event name: `notification`):

```json
{
  "id": "notif_123",
  "eventType": "MILESTONE_TEMPLATE_CREATED",
  "severity": "INFO",
  "title": "New Milestone Template (Computer Science)",
  "message": "A new milestone template \"Standard\" was created with 2 milestones.",
  "metadata": {
    "departmentId": "dep_123",
    "departmentName": "Computer Science",
    "templateId": "tpl_123",
    "templateName": "Standard",
    "milestoneCount": 2,
    "actorUserId": "user_123"
  },
  "status": "UNREAD",
  "createdAt": "2026-03-01T12:00:00.000Z"
}
```

---

## A3) Update milestone template

- **PUT** `/departments/:departmentId/milestone-templates/:templateId`
- **HTTP**: `200 OK`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Body (all optional):

```json
{
  "name": "Updated name",
  "description": "Updated description",
  "isActive": false,
  "milestones": [
    {
      "sequence": 1,
      "title": "Proposal",
      "defaultDurationDays": 10,
      "hasDeliverable": true,
      "requiredDocuments": ["proposal.pdf"],
      "isRequired": true
    }
  ]
}
```

Notes:
- If you send `milestones`, the backend treats it as a **full replacement** of the milestone list.
- `milestones[].sequence` must be **unique**.

Success (`data`):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "message": "Milestone template updated successfully",
    "templateId": "tpl_123",
    "name": "Updated name",
    "milestoneCount": 1,
    "updatedAt": "2026-03-01T12:00:00.000Z"
  },
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

Common errors:
- `400` duplicate milestone sequences
- `404` template not found

---

## A4) Delete milestone template

- **DELETE** `/departments/:departmentId/milestone-templates/:templateId`
- **HTTP**: `200 OK`
- Roles: `DEPARTMENT_HEAD`, `COORDINATOR`

Success (`data`):

```json
{
  "success": true,
  "message": "Success",
  "data": { "message": "Milestone template deleted successfully" },
  "timestamp": "2026-03-01T12:00:00.000Z"
}
```

Common errors:
- `404` template not found

---

# B) Department Document Templates (SRS/SDD Files Library)

This is a separate feature from milestone schedule templates: it stores **actual downloadable files**.

## B1) List document templates

- **GET** `/departments/:departmentId/document-templates`
- **HTTP**: `200 OK`

Query params:
- `page` (number, default `1`)
- `limit` (number, default `10`)
- `type` (`SRS | SDD | REPORT | OTHER`, optional)
- `isActive` (boolean, optional)
- `search` (string, optional; searches by title)

Success (`data`):

```json
{
  "templates": [
    {
      "templateId": "docTpl_123",
      "type": "SRS",
      "title": "SRS Template",
      "description": null,
      "isActive": true,
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-03-01T12:00:00.000Z",
      "files": [
        {
          "fileId": "file_1",
          "fileName": "SRS.docx",
          "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "sizeBytes": 120034,
          "url": "https://res.cloudinary.com/...",
          "createdAt": "2026-03-01T12:00:00.000Z"
        }
      ]
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
}
```

---

## B2) Get one document template

- **GET** `/departments/:departmentId/document-templates/:templateId`
- **HTTP**: `200 OK`

Returns the template + file URLs.

---

## B3) Create document template (multipart upload)

- **POST** `/departments/:departmentId/document-templates`
- **HTTP**: `201 Created`
- Content-Type: `multipart/form-data`

Form fields:
- `type`: `SRS | SDD | REPORT | OTHER`
- `title`: string
- `description`: string (optional)
- `isActive`: boolean (optional)
- `files`: one or more files (field name is `files`)

Constraints:
- Allowed file types: **PDF** and **DOCX**
- Max size: **10MB per file**
- Max number of files per request: **10**

Success (`data`):

```json
{
  "message": "Department document template created successfully",
  "templateId": "docTpl_123",
  "title": "SRS Template",
  "type": "SRS",
  "fileCount": 2,
  "createdAt": "2026-03-01T12:00:00.000Z"
}
```

---

## B4) Update document template metadata

- **PATCH** `/departments/:departmentId/document-templates/:templateId`
- **HTTP**: `200 OK`

Body (all optional):

```json
{ "title": "Updated title", "type": "SDD", "isActive": false }
```

---

## B5) Add more files to an existing template

- **POST** `/departments/:departmentId/document-templates/:templateId/files`
- **HTTP**: `201 Created`
- Content-Type: `multipart/form-data`

Form fields:
- `files`: one or more files (field name `files`)

---

## B6) Replace all files for an existing template

- **PUT** `/departments/:departmentId/document-templates/:templateId/files`
- **HTTP**: `200 OK`
- Content-Type: `multipart/form-data`

Form fields:
- `files`: one or more files (field name `files`)

---

## B7) Delete one file from a template

- **DELETE** `/departments/:departmentId/document-templates/:templateId/files/:fileId`
- **HTTP**: `200 OK`

---

## B8) Delete a document template

- **DELETE** `/departments/:departmentId/document-templates/:templateId`
- **HTTP**: `200 OK`

---

## Frontend note: “download” behavior

The API returns `files[].url` (Cloudinary `secure_url`). Your frontend can download/open the file directly using that URL.
