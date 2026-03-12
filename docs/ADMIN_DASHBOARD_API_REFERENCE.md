# Admin Dashboard API Reference (Exact Endpoints + Sample Responses)

This document lists the **Admin Dashboard** endpoints that were implemented/extended for managing universities (tenants), including **exact paths** and **sample responses**.

All endpoints are under the versioned API prefix:

- Base: `/api/v1`

All successful responses are wrapped as:

```json
{
  "success": true,
  "message": "Success",
  "data": { "...": "..." },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

All errors are wrapped as:

```json
{
  "success": false,
  "message": "Human readable error",
  "error": { "code": "ERROR_CODE", "details": {} },
  "timestamp": "2026-02-22T10:30:00.000Z",
  "path": "/api/v1/admin/tenants"
}
---

## Authentication (Admin)

### 1) Admin login

- **POST** `/api/v1/admin/auth/login`
- Public: **Yes**
- Rate limit: **5/min**

Request body:

```json
{
  "email": "admin@example.com",
  "password": "YourPassword"
}
```

Success (2FA not enabled):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accessToken": "<jwt-access-token>",
    "refreshToken": "<jwt-refresh-token>",
    "user": {
      "id": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
      "email": "admin@example.com",
      "firstName": "Platform",
      "lastName": "Admin",
      "roles": ["PlatformAdmin"],
      "tenantId": "system"
    }
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Success (2FA enabled):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "requiresTwoFactor": true,
    "twoFactorToken": "<opaque-two-factor-token>"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `401 Unauthorized`: invalid credentials
- `429 Too Many Requests`: throttled

---

### 2) Complete admin login with 2FA / backup code

- **POST** `/api/v1/admin/auth/login/2fa`
- Public: **Yes**
- Rate limit: **5/min**

Request body:

```json
{
  "twoFactorToken": "<twoFactorToken-from-login>",
  "code": "123456",
  "method": "totp"
}
```

Notes:

- `method` can be `totp` (default) or `backup_code`.

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accessToken": "<jwt-access-token>",
    "refreshToken": "<jwt-refresh-token>",
    "user": {
      "id": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
      "email": "admin@example.com",
      "firstName": "Platform",
      "lastName": "Admin",
      "roles": ["PlatformAdmin"],
      "tenantId": "system"
    }
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `403 Forbidden`: invalid 2FA token/code
- `429 Too Many Requests`: throttled

---

### 3) Refresh access token

- **POST** `/api/v1/admin/auth/refresh`
- Public: **Yes**
- Rate limit: **30/min**

Request body:

```json
{
  "refreshToken": "<jwt-refresh-token>"
}
```

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accessToken": "<new-jwt-access-token>",
    "refreshToken": "<new-jwt-refresh-token>"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `401 Unauthorized`: invalid/expired refresh token

---

### 4) Get current admin session profile

- **GET** `/api/v1/admin/auth/me`
- Auth: **Bearer token required**
- Role: `PlatformAdmin`

Headers:

- `Authorization: Bearer <accessToken>`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
    "email": "admin@example.com",
    "firstName": "Platform",
    "lastName": "Admin",
    "avatarUrl": null,
    "avatarPublicId": null,
    "tenantId": "system",
    "roles": ["PlatformAdmin"],
    "lastLoginAt": "2026-02-22T10:20:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 5) Logout

- **POST** `/api/v1/admin/auth/logout`
- Auth: **Bearer token required**
- Role: `PlatformAdmin`

Headers:

- `Authorization: Bearer <accessToken>`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "message": "Logged out"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Notes:

- This API is stateless. The client should clear stored tokens.

---

## Two-Factor Authentication (Admin)

All endpoints below require:

- Auth: **Bearer token required**
- Role: `PlatformAdmin`

### 1) Get 2FA status

- **GET** `/api/v1/admin/auth/2fa/status`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "enabled": true,
    "verifiedAt": "2026-02-22T10:20:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 2) Start enabling 2FA (returns secret + otpauth URL)

- **POST** `/api/v1/admin/auth/2fa/enable`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "enabled": false,
    "secret": "<totp-secret>",
    "otpauthUrl": "otpauth://totp/Academic%20Platform:admin%40example.com?secret=...&issuer=Academic%20Platform",
    "label": "Academic Platform:admin@example.com"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Notes:

- `secret`/`otpauthUrl` should be treated as sensitive and shown only to the admin configuring 2FA.

---

### 3) Verify 2FA code and activate 2FA

- **POST** `/api/v1/admin/auth/2fa/verify`
- Rate limit: **10/min**

Request body:

```json
{ "code": "123456" }
```

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": { "enabled": true },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `403 Forbidden`: invalid code
- `429 Too Many Requests`: throttled

---

### 4) Disable 2FA

- **POST** `/api/v1/admin/auth/2fa/disable`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": { "enabled": false },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

## Backup Codes (Admin)

All endpoints below require:

- Auth: **Bearer token required**
- Role: `PlatformAdmin`

### 1) Get remaining backup codes count

- **GET** `/api/v1/admin/auth/2fa/backup-codes/status`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": { "remaining": 7 },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 2) Generate backup codes (shown once)

- **POST** `/api/v1/admin/auth/2fa/backup-codes/generate`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "codes": ["ABCD-EFGH", "IJKL-MNOP"],
    "count": 10,
    "message": "Backup codes generated. Store them securely; they will not be shown again."
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 3) Regenerate backup codes (invalidates old codes)

- **POST** `/api/v1/admin/auth/2fa/backup-codes/regenerate`

Success:

- Same response as **Generate backup codes**.

---

## Universities (Tenants)

All endpoints below require:

- Auth: **Bearer token required**
- Role: `PlatformAdmin`

### 1) List universities (tenants)

- **GET** `/api/v1/admin/tenants`

Query params (optional):

- `page` (default `1`)
- `limit` (default `10`, max `100`)
- `search` (matches tenant name/domain)
- `status` (`TRIAL | ACTIVE | SUSPENDED | CANCELLED`)

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
        "name": "Addis Ababa University",
        "domain": "addisababauniversity",
        "status": "ACTIVE",
        "onboardingDate": "2026-02-20T08:15:22.123Z",
        "config": { "type": "university" },
        "createdAt": "2026-02-20T08:15:22.123Z",
        "updatedAt": "2026-02-21T09:40:10.456Z"
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 2) Create tenant (university)

- **POST** `/api/v1/admin/tenants`

Request body:

```json
{
  "name": "Addis Ababa University",
  "domain": "addisababauniversity",
  "config": { "type": "university" }
}
```

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "TRIAL",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": { "type": "university" },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-20T08:15:22.123Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `400 Bad Request`: validation failed
- `400 Bad Request`: domain already exists

---

### 3) Get tenant by id (basic)

- **GET** `/api/v1/admin/tenants/:tenantId`

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "ACTIVE",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": { "type": "university" },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-21T09:40:10.456Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `404 Not Found`: tenant not found

---

### 4) Tenant overview (details page: creator + address + stats)

- **GET** `/api/v1/admin/tenants/:tenantId/overview`

Query params (optional):

- `includeInactive=true` (default: false => ACTIVE users only)
- `roleName=Student` (optional role filter)

Success (example):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "tenant": {
      "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
      "name": "Addis Ababa University",
      "domain": "addisababauniversity",
      "status": "ACTIVE",
      "onboardingDate": "2026-02-20T08:15:22.123Z",
      "config": {
        "type": "university",
        "onboardingComplete": false,
        "createdByUserId": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
        "createdBy": {
          "userId": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
          "email": "depthead@aau.edu.et",
          "firstName": "John",
          "lastName": "Smith",
          "role": "DepartmentHead",
          "createdAt": "2026-02-20T08:15:22.500Z"
        },
        "address": {
          "country": "Ethiopia",
          "city": "Addis Ababa",
          "region": "Addis Ababa",
          "street": "King George VI St",
          "phone": "+251-11-123-4567",
          "website": "https://www.aau.edu.et"
        }
      },
      "createdAt": "2026-02-20T08:15:22.123Z",
      "updatedAt": "2026-02-21T09:40:10.456Z"
    },
    "creator": {
      "id": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
      "email": "depthead@aau.edu.et",
      "firstName": "John",
      "lastName": "Smith",
      "status": "ACTIVE",
      "createdAt": "2026-02-20T08:15:22.500Z"
    },
    "address": {
      "country": "Ethiopia",
      "city": "Addis Ababa",
      "region": "Addis Ababa",
      "street": "King George VI St",
      "phone": "+251-11-123-4567",
      "website": "https://www.aau.edu.et"
    },
    "stats": {
      "includeInactive": false,
      "totalUsers": 42,
      "departments": [
        {
          "id": "d1b7f7d0-1c2a-4bda-8ccf-9c3a7d7a1c90",
          "name": "Computer Science",
          "code": "CS",
          "headOfDepartmentId": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
          "head": {
            "id": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
            "email": "depthead@aau.edu.et",
            "firstName": "John",
            "lastName": "Smith",
            "status": "ACTIVE"
          },
          "totalUsers": 25
        }
      ]
    }
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Notes:

- `creator` can be `null` for admin-created tenants (`POST /admin/tenants`).
- Department head info is per department: `stats.departments[].head`.

---

### 5) Update tenant (name/domain/config)

- **PATCH** `/api/v1/admin/tenants/:tenantId`

Request body (all optional; only provided fields are updated):

```json
{
  "name": "Addis Ababa University (Updated)",
  "domain": "addisababauniversity",
  "config": { "type": "university", "onboardingComplete": true }
}
```

Notes:

- If `config` is provided, immutable fields are preserved and cannot be overridden by admin updates:
  - `config.createdByUserId`
  - `config.createdBy`

Success (returns the updated tenant object):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University (Updated)",
    "domain": "addisababauniversity",
    "status": "ACTIVE",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": {
      "type": "university",
      "onboardingComplete": true,
      "createdByUserId": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
      "createdBy": {
        "userId": "9b1f1e8a-0f5d-4d28-9a06-4f2cb0d9c333",
        "email": "depthead@aau.edu.et",
        "firstName": "John",
        "lastName": "Smith",
        "role": "DepartmentHead",
        "createdAt": "2026-02-20T08:15:22.500Z"
      }
    },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-22T10:29:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `404 Not Found`: tenant not found
- `400 Bad Request`: domain already exists

---

### 6) Update tenant address

- **PATCH** `/api/v1/admin/tenants/:tenantId/address`

Request body (all optional; only provided fields are updated):

```json
{
  "country": "Ethiopia",
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "street": "King George VI St",
  "phone": "+251-11-123-4567",
  "website": "https://www.aau.edu.et"
}
```

Success (returns the updated tenant object):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "ACTIVE",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": {
      "address": { "country": "Ethiopia", "city": "Addis Ababa" }
    },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-22T10:29:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 7) Update tenant status

- **PATCH** `/api/v1/admin/tenants/:tenantId/status`

Request body:

```json
{ "status": "SUSPENDED" }
```

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "SUSPENDED",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": { "type": "university" },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-22T10:29:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

---

### 8) Delete tenant (hard delete / purge)

- **DELETE** `/api/v1/admin/tenants/:tenantId`

Notes:

- This is a **hard delete/purge**. It permanently removes the tenant and tenant-scoped data.
- This operation is destructive and cannot be undone.
- The response returns a snapshot of the tenant taken before deletion.
- Trying to delete the `system` tenant returns `400 Bad Request`.

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "3a2c6a9b-9a4e-4b0c-9d4a-3e9b2f0c1f11",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "ACTIVE",
    "onboardingDate": "2026-02-20T08:15:22.123Z",
    "config": { "type": "university" },
    "createdAt": "2026-02-20T08:15:22.123Z",
    "updatedAt": "2026-02-22T10:29:00.000Z"
  },
  "timestamp": "2026-02-22T10:30:00.000Z"
}
```

Common errors:

- `404 Not Found`: tenant not found
- `400 Bad Request`: cannot delete system tenant
