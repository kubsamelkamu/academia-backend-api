# Frontend Integration Guide: Department Head — Users, Faculty, Invitations

This document describes how to integrate the **Department Head user/faculty management** screens with the backend API:

- List Faculty (Advisors + Coordinators) with pagination + search
- List Department Users (Students + Faculty) with pagination + search + role filters
- List Invitations with pagination + search + role/status filters (for “Pending Students” vs “Pending Faculty” tabs)
- Invite new Users (invitation-only onboarding)
- View user details, update user profile fields, deactivate users

---

## 1) Base URL + versioning

- Base URL (local): `http://localhost:3001`
- API prefix + versioning (default): `/api/v1`
- Swagger: `http://localhost:3001/api/docs`

All routes below are shown with the full prefix, e.g. `GET /api/v1/tenant/faculty`.

---

## 2) Auth header + roles

All endpoints in this document require:

- Header: `Authorization: Bearer <ACCESS_TOKEN>`
- Role: `DepartmentHead`

---

## 3) Standard response wrapper

Most endpoints use a standard response wrapper. Your UI should read the payload from `data`:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-03-05T18:19:11.868Z"
}
```

When this guide shows a **Response (data)** section, it refers to the content inside `data`.

---



## 4) Data shapes

### A) Pagination object

```json
{
  "total": 123,
  "page": 1,
  "limit": 20,
  "pages": 7
}
```

### B) User list item (common fields)

User list endpoints return users with fields similar to:

```json
{
  "id": "user-id",
  "email": "someone@uni.edu",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "status": "ACTIVE",
  "emailVerified": true,
  "lastLoginAt": "2026-03-01T10:00:00.000Z",
  "createdAt": "2026-02-20T10:00:00.000Z",
  "roles": [
    {
      "role": {
        "name": "ADVISOR"
      }
    }
  ]
}
```

---

## 5) Faculty list (Advisors + Coordinators)

### 5.1) List faculty

**Endpoint**

- `GET /api/v1/tenant/faculty`

**Query params (optional)**

- `search` — search by `email`, `firstName`, `lastName`
- `q` — alias of `search`
- `page` — default: `1`
- `limit` — default: `20` (max `100`)

**Example request**

- `GET /api/v1/tenant/faculty?page=1&limit=20&search=abebe`

**Response (data)**

```json
{
  "users": [
    {
      "id": "u1",
      "email": "advisor@uni.edu",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "status": "ACTIVE",
      "emailVerified": true,
      "lastLoginAt": null,
      "createdAt": "2026-03-05T00:00:00.000Z",
      "roles": [{ "role": { "name": "ADVISOR" } }]
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
}
```

---

## 6) Department users list (Students + Faculty)

### 6.1) List users (paginated + role-filterable)

**Endpoint**

- `GET /api/v1/tenant/users/paged`

**Query params (optional)**

- `search` — search by `email`, `firstName`, `lastName`
- `roleNames` — filter by roles (CSV supported)
  - Examples:
    - `roleNames=STUDENT`
    - `roleNames=ADVISOR,COORDINATOR`
- `page` — default: `1`
- `limit` — default: `20` (max `100`)

**Example requests**

- Students only: `GET /api/v1/tenant/users/ paged?roleNames=STUDENT&page=1&limit=20`
- Faculty only: `GET /api/v1/tenant/users/paged?roleNames=ADVISOR,COORDINATOR&page=1&limit=20`
- Search all: `GET /api/v1/tenant/users/paged?search=abebe&page=1&limit=20`

**Response (data)**

```json
{
  "users": [
    {
      "id": "s1",
      "email": "student1@uni.edu",
      "firstName": "Student",
      "lastName": "One",
      "status": "ACTIVE",
      "emailVerified": false,
      "lastLoginAt": null,
      "createdAt": "2026-03-05T00:00:00.000Z",
      "roles": [{ "role": { "name": "STUDENT" } }]
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
}
```

---


## 7) User details + update + deactivate

### 7.1) Get user detail

- `GET /api/v1/tenant/users/:id`

### 7.2) Update user (basic profile fields)

- `PUT /api/v1/tenant/users/:id`

**Body**

```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "email": "updated@uni.edu"
}
```

### 7.3) Deactivate user

- `DELETE /api/v1/tenant/users/:id`

### 7.4) Reactivate user

- `PATCH /api/v1/tenant/users/:id/reactivate`

**Success response**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "80af090a-8e9f-4287-ae40-bb59fcda5320",
    "status": "ACTIVE",
    "deletedAt": null
  },
  "timestamp": "2026-03-24T08:40:00.000Z"
}
```

**Error cases**

- `404 User not found` when user is outside the department/tenant scope or does not exist.
- `400 User is not deactivated` when trying to reactivate a user that is already active (or not soft-deleted).

---

