# Frontend Integration Guide — Department Document Templates (API v1)

This page documents the **Student-facing** endpoints needed to list and view department document templates.

## Base

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <access_token>`
- Allowed roles:
  - `DEPARTMENT_HEAD`, `COORDINATOR`, `ADVISOR`, `STUDENT`

> Important: the backend enforces department isolation. A user can only access templates for their own `departmentId`.

---

## 1) List templates

### Endpoint

`GET /api/v1/departments/{departmentId}/document-templates`

### Query params (all optional)

- `page` (number, default `1`, min `1`)
- `limit` (number, default `10`, min `1`, max `100`)
- `type` (`SRS` | `SDD` | `REPORT` | `OTHER`)
- `isActive` (`true` | `false`)
- `search` (string) — searches by template `title`

### Example request

```http
GET /api/v1/departments/DEPT_ID/document-templates?page=1&limit=10&isActive=true&type=SRS&search=srs
Authorization: Bearer <token>
```

### 200 OK — Response

```json
{
  "templates": [
    {
      "templateId": "uuid",
      "type": "SRS",
      "title": "Software Requirements Specification (SRS)",
      "description": "Use this format for your SRS document",
      "isActive": true,
      "createdAt": "2026-03-08T10:00:00.000Z",
      "updatedAt": "2026-03-08T10:00:00.000Z",
      "files": [
        {
          "fileId": "uuid",
          "fileName": "SRS_Template.docx",
          "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "sizeBytes": 123456,
          "url": "https://res.cloudinary.com/.../raw/upload/.../file.docx",
          "createdAt": "2026-03-08T10:00:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

### Common errors

- `401 Unauthorized` — token missing/invalid
- `403 Forbidden` — user not allowed to access this department
- `400 Bad Request` — invalid query params

---

## 2) Get single template

### Endpoint

`GET /api/v1/departments/{departmentId}/document-templates/{templateId}`

### Example request

```http
GET /api/v1/departments/DEPT_ID/document-templates/TEMPLATE_ID
Authorization: Bearer <token>
```

### 200 OK — Response

```json
{
  "templateId": "uuid",
  "type": "SRS",
  "title": "Software Requirements Specification (SRS)",
  "description": "Use this format for your SRS document",
  "isActive": true,
  "createdAt": "2026-03-08T10:00:00.000Z",
  "updatedAt": "2026-03-08T10:00:00.000Z",
  "files": [
    {
      "fileId": "uuid",
      "fileName": "SRS_Template.docx",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "sizeBytes": 123456,
      "url": "https://res.cloudinary.com/.../raw/upload/.../file.docx",
      "createdAt": "2026-03-08T10:00:00.000Z"
    }
  ]
}
```

### Common errors

- `401 Unauthorized` — token missing/invalid
- `403 Forbidden` — user not allowed to access this department
- `404 Not Found` — template not found for this department
