# Frontend Integration Guide: Coordinator and Department Head Student Directory

This document describes how to integrate the department student directory screen with the backend API.

The endpoint returns:

- Paginated students in the current department
- Student account status and last login
- Student profile details
- Current project group details if the student has joined a group
- Derived group role as `LEADER` or `MEMBER`
- Department-level summary counts for students and project groups

---

## 1) Base URL + versioning

- Base URL (local): `http://localhost:3001`
- API prefix + versioning (default): `/api/v1`
- Swagger: `http://localhost:3001/api/docs`

Full route:

- `GET /api/v1/analytics/students/directory`

---

## 2) Auth header + roles

This endpoint requires:

- Header: `Authorization: Bearer <ACCESS_TOKEN>`
- Role: `DepartmentHead` or `Coordinator`

The request is scoped to the authenticated user's department by default.

---

## 3) Standard response wrapper

Most endpoints use a standard response wrapper. Your UI should read the payload from `data`.

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-07T09:00:00.000Z"
}
```

When this guide shows a **Response (data)** block, it refers to the content inside `data`.

---

## 4) Query params

All query params are optional.

- `departmentId` - overrides the department id, but access still follows backend authorization rules
- `search` - searches `firstName`, `lastName`, and `email`
- `userStatus` - filters by account status, for example `ACTIVE` or `PENDING`
- `groupStatus` - filters by project group status, for example `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`
- `hasGroup` - filters by group membership using `true` or `false`
- `page` - default `1`
- `limit` - default `20`, max `100`

Example:

- `GET /api/v1/analytics/students/directory?page=1&limit=20&search=abebe`
- `GET /api/v1/analytics/students/directory?hasGroup=true&groupStatus=APPROVED&page=1&limit=20`
- `GET /api/v1/analytics/students/directory?userStatus=ACTIVE&hasGroup=false&page=1&limit=20`

---

## 5) Response shape

### 5.1) Summary

```json
{
  "totalStudents": 120,
  "totalProjectGroups": 35,
  "approvedProjectGroups": 20,
  "rejectedProjectGroups": 5
}
```

### 5.2) Pagination

```json
{
  "total": 37,
  "page": 1,
  "limit": 20,
  "pages": 2
}
```

`pagination.total` reflects the current filter set. `summary` remains department-wide so the dashboard cards do not change when the table is filtered.

### 5.3) Student directory item

```json
{
  "student": {
    "id": "user-id",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "email": "abebe@uni.edu",
    "avatarUrl": null,
    "userStatus": "ACTIVE",
    "lastLoginAt": "2026-04-05T14:20:00.000Z"
  },
  "profile": {
    "bio": "Backend and mobile developer",
    "githubUrl": "https://github.com/abebe",
    "linkedinUrl": null,
    "portfolioUrl": null,
    "techStack": ["NestJS", "Flutter", "PostgreSQL"]
  },
  "group": {
    "hasGroup": true,
    "role": "LEADER",
    "id": "group-id",
    "name": "Smart Irrigation Team",
    "status": "APPROVED"
  }
}
```

If the student is not in a group:

```json
{
  "group": {
    "hasGroup": false,
    "role": null,
    "id": null,
    "name": null,
    "status": null
  }
}
```

---

## 6) Example response

```json
{
  "summary": {
    "totalStudents": 120,
    "totalProjectGroups": 35,
    "approvedProjectGroups": 20,
    "rejectedProjectGroups": 5
  },
  "items": [
    {
      "student": {
        "id": "0b1f8dd9-1111-2222-3333-444444444444",
        "firstName": "Abebe",
        "lastName": "Kebede",
        "email": "abebe@uni.edu",
        "avatarUrl": null,
        "userStatus": "ACTIVE",
        "lastLoginAt": "2026-04-05T14:20:00.000Z"
      },
      "profile": {
        "bio": "Backend and mobile developer",
        "githubUrl": "https://github.com/abebe",
        "linkedinUrl": null,
        "portfolioUrl": null,
        "techStack": ["NestJS", "Flutter", "PostgreSQL"]
      },
      "group": {
        "hasGroup": true,
        "role": "LEADER",
        "id": "9a7a7aa1-5555-6666-7777-888888888888",
        "name": "Smart Irrigation Team",
        "status": "APPROVED"
      }
    }
  ],
  "pagination": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "pages": 6
  }
}
```

---

## 7) Frontend notes

- Use `summary.totalStudents` for the main student count card.
- Use `summary.totalProjectGroups`, `summary.approvedProjectGroups`, and `summary.rejectedProjectGroups` for dashboard stat cards.
- Use `pagination.total` for the filtered table count when search or filters are active.
- Render `group.role` as a display badge only when `group.hasGroup === true`.
- Render `lastLoginAt` as `Never logged in` when it is `null`.
- Render profile fields defensively because `bio`, social URLs, and `techStack` may be empty.

---

## 8) Recommended table columns

- Student name
- Email
- Account status
- Last login
- Group name
- Group role
- Group review status

---

## 9) Suggested empty states

- No students found for current page/filter: `No students matched your search.`
- Student has no group: show `No group yet`
- Student profile is still empty: show `Profile not completed`