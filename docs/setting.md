# Department Settings API (Group Size) + Project Members API

Base URL (local default): `http://localhost:3001`

API prefix/version (from env): `/api/v1`

Auth: `Authorization: Bearer <accessToken>`

---

## 1) Department Settings — Group Size

These endpoints store and return the **minimum** and **maximum** number of **students** allowed in a project group for a department.

### Roles

- Allowed: `DepartmentHead`, `Coordinator`, `PlatformAdmin`
- Notes:
  - For `PlatformAdmin`, you can optionally pass `departmentId` as a query param to target any department.
  - For non-admin users, the department is derived from the authenticated user.

### Defaults

If a department has no saved group size settings yet, the API returns defaults:

- `minGroupSize = 3`
- `maxGroupSize = 5`

### 1.1 Get group size settings

**GET** `/api/v1/department/settings/group-size`

Optional query (PlatformAdmin only):
- `departmentId` (uuid)

**Response (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "minGroupSize": 3,
    "maxGroupSize": 5
  },
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Common error responses**

- **403** (Insufficient permissions)
- **400** (PlatformAdmin without `departmentId` and not assigned to a department)

### 1.2 Update group size settings (upsert)

**PUT** `/api/v1/department/settings/group-size`

Optional query (PlatformAdmin only):
- `departmentId` (uuid)

**Request body**
```json
{
  "minGroupSize": 3,
  "maxGroupSize": 5
}
```

**Validation rules**
- Both fields must be integers
- `minGroupSize >= 1`
- `maxGroupSize >= 1`
- `minGroupSize <= maxGroupSize`

**Response (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "minGroupSize": 3,
    "maxGroupSize": 5
  },
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Error examples**

- **400** (min > max)
```json
{
  "success": false,
  "message": "minGroupSize must be less than or equal to maxGroupSize",
  "error": {
    "code": "BADREQUEST"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/department/settings/group-size"
}
```

---

## 2) Projects — Members (Enforces Department Group Size)

These endpoints manage **student** membership in a project and enforce the department’s group size limits.

### Roles

- **Add / Remove members**: `DepartmentHead`, `Coordinator`, `PlatformAdmin`
- **List members**:
  - `PlatformAdmin`: allowed
  - `Student`: allowed only if the student is a member of the project
  - Other authenticated users: must pass department/tenant access checks

### Important enforcement rules

1) **Only STUDENT members count toward min/max**
- Advisors are stored as `ProjectMember` with role `ADVISOR`, but they do **not** count toward group size limits.

2) **Project must be ACTIVE to add/remove members**
- If project status is `COMPLETED` or `CANCELLED`, add/remove is blocked.

3) Target user checks when adding
- Target user must be:
  - `ACTIVE`
  - same tenant as the project
  - same department as the project
  - has active `Student` role in the tenant

### 2.1 List project members

**GET** `/api/v1/projects/:id/members`

**Response (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "projectId": "b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11",
    "members": [
      {
        "userId": "a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000",
        "role": "STUDENT",
        "joinedAt": "2026-02-28T10:30:00.000Z",
        "user": {
          "id": "a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000",
          "firstName": "Sara",
          "lastName": "Abebe",
          "email": "sara@uni.edu",
          "avatarUrl": null,
          "status": "ACTIVE"
        }
      },
      {
        "userId": "c18a7e92-b92b-4a2e-8b4e-4215d90a9e11",
        "role": "ADVISOR",
        "joinedAt": "2026-02-28T10:30:01.000Z",
        "user": {
          "id": "c18a7e92-b92b-4a2e-8b4e-4215d90a9e11",
          "firstName": "Dr",
          "lastName": "Kebede",
          "email": "advisor@uni.edu",
          "avatarUrl": null,
          "status": "ACTIVE"
        }
      }
    ]
  },
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 2.2 Add student member

**POST** `/api/v1/projects/:id/members`

**Request body**
```json
{
  "userId": "a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000"
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "projectId": "b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11",
    "userId": "a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000",
    "role": "STUDENT",
    "minGroupSize": 3,
    "maxGroupSize": 5
  },
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Common errors**

- **400** (max exceeded)
```json
{
  "success": false,
  "message": "Group cannot exceed maxGroupSize (5)",
  "error": {
    "code": "BADREQUEST"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/projects/b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11/members"
}
```

- **400** (project not ACTIVE)
```json
{
  "success": false,
  "message": "Cannot modify members for non-active projects",
  "error": {
    "code": "BADREQUEST"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/projects/b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11/members"
}
```

- **400** (target user not ACTIVE / not student)

### 2.3 Remove student member

**DELETE** `/api/v1/projects/:id/members/:userId`

**Response (200)**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "projectId": "b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11",
    "userId": "a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000",
    "role": "STUDENT",
    "minGroupSize": 3,
    "maxGroupSize": 5
  },
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Common errors**

- **400** (min violated)
```json
{
  "success": false,
  "message": "Group cannot go below minGroupSize (3)",
  "error": {
    "code": "BADREQUEST"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/projects/b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11/members/a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000"
}
```

- **400** (attempt to remove non-student)
```json
{
  "success": false,
  "message": "Only STUDENT members can be removed with this endpoint",
  "error": {
    "code": "BADREQUEST"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/projects/b6f8d8c2-1f2d-4b1c-9e8a-1d5a7d6b1a11/members/a0d6a9f3-7b65-4aaf-9bd1-26a8f4c74000"
}
```

---

## Frontend integration notes

- The backend uses NestJS API versioning, so the stable URL format is `/api/v1/...`.
- For group-size settings, you likely call:
  - `GET /department/settings/group-size` on settings screen load
  - `PUT /department/settings/group-size` when user saves
- For project members:
  - call `GET /projects/:id/members` to render a member list
  - call `POST /projects/:id/members` to add a student
  - call `DELETE /projects/:id/members/:userId` to remove a student

### Notifications (real-time)

When group size settings are changed (values actually change), the backend creates an in-app notification for users in that department and emits a Socket.IO `notification` event.

- Socket namespace: `/notifications`
- Event name: `notification`
- `eventType`: `DEPARTMENT_GROUP_SIZE_UPDATED`
- Payload shape (example)
```json
{
  "id": "2f1a0c6f-0f0c-4ae0-9c6d-0ab0f0f1c001",
  "eventType": "DEPARTMENT_GROUP_SIZE_UPDATED",
  "severity": "INFO",
  "title": "Group Size Updated (Computer Science)",
  "message": "Computer Science group size updated: min 3, max 5.",
  "metadata": {
    "departmentId": "d1",
    "departmentName": "Computer Science",
    "minGroupSize": 3,
    "maxGroupSize": 5,
    "actorUserId": "u1"
  },
  "status": "UNREAD",
  "createdAt": "2026-02-28T10:30:00.000Z"
}
```
