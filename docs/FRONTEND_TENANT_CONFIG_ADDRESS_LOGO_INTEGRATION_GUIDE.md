# Frontend Integration Guide: Institution (Tenant) Config, Address, Logo, and Notifications

This document explains how to integrate the frontend with the institution (tenant) configuration endpoints that can be used by **Department Head** and **Platform Admin**.

It covers:
- Reading the current institution details
- Updating arbitrary tenant config
- Updating institution address/contact details (stored under `tenant.config.address`)
- Uploading institution logo (stored under `tenant.config.branding`)
- Receiving in-app notifications for address/logo updates (REST + Socket.IO)

## Base URL + Auth

- Base API prefix (typical): `/api/v1`
- All endpoints below require a valid JWT access token.
- Add header:
  - `Authorization: Bearer <access_token>`

Authorization (RBAC):
- Allowed roles for the tenant config endpoints in this guide:
  - `DEPARTMENT_HEAD`
  - `PLATFORM_ADMIN`

---

## 1) Get Current Institution (Tenant)

**GET** `/api/v1/tenant/current`

Returns the tenant record for the authenticated user’s `tenantId`.

### Example

```bash
curl -X GET "<BASE_URL>/api/v1/tenant/current" \
  -H "Authorization: Bearer <TOKEN>"
```

### What to use on the frontend

- Use this endpoint to display institution info.
- The institution settings you update in this guide are stored inside `tenant.config` (JSON).

Important config paths:
- Address/contact: `tenant.config.address`
- Branding: `tenant.config.branding.logoUrl`, `tenant.config.branding.logoPublicId`

---

## 2) Update Tenant Config (Generic)

**PUT** `/api/v1/tenant/config`

This updates the tenant’s `config` JSON. It is rate-limited (5 requests per 60 seconds).

### Body

```json
{
  "config": {
    "any": "json"
  }
}
```

### Example

```bash
curl -X PUT "<BASE_URL>/api/v1/tenant/config" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "onboardingComplete": false
    }
  }'
```

Notes:
- This is a generic endpoint. If your UI is specifically updating address or logo, prefer the dedicated endpoints below.

---

## 3) Update Institution Address + Contact Details

**PATCH** `/api/v1/tenant/address`

Stores address/contact values under `tenant.config.address`.

### DTO fields (all optional)

- `country` (string)
- `city` (string)
- `region` (string)
- `street` (string)
- `phone` (string)
- `website` (string)

Behavior:
- The backend merges fields into the existing `tenant.config.address` object.
- Fields not provided are not overwritten.

### Example

```bash
curl -X PATCH "<BASE_URL>/api/v1/tenant/address" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "Egypt",
    "city": "Cairo",
    "region": "Nasr City",
    "street": "Some street",
    "phone": "+20 123 456 789",
    "website": "https://university.example"
  }'
```

### Where it is stored

After update, the tenant config will include something like:

```json
{
  "address": {
    "country": "Egypt",
    "city": "Cairo",
    "region": "Nasr City",
    "street": "Some street",
    "phone": "+20 123 456 789",
    "website": "https://university.example"
  }
}
```

---

## 4) Upload / Update Institution Logo

**POST** `/api/v1/tenant/logo`

- Content-Type: `multipart/form-data`
- Form field name: `logo`

Validation:
- Max file size: **5MB**
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

Behavior:
- Uploads to Cloudinary (stored as `webp`, overwrite enabled).
- Persists into `tenant.config.branding`:
  - `logoUrl`
  - `logoPublicId`

### Example (curl)

```bash
curl -X POST "<BASE_URL>/api/v1/tenant/logo" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "logo=@./university-logo.png"
```

### Where it is stored

After upload, config will include:

```json
{
  "branding": {
    "logoUrl": "https://.../logo.webp",
    "logoPublicId": "academic-platform/tenants/logos/tenant_logo_<tenantId>"
  }
}
```

Frontend usage:
- Use `tenant.config.branding.logoUrl` directly as the image URL.

---

## 5) In-App Notifications (REST)

Notifications are stored in the database and also emitted in real-time via websocket.

### List notifications

**GET** `/api/v1/notifications`

Query params (optional):
- `status`: `READ` | `UNREAD`
- `limit`: number
- `offset`: number

Example:

```bash
curl -X GET "<BASE_URL>/api/v1/notifications?status=UNREAD&limit=20&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

### Unread count

**GET** `/api/v1/notifications/unread-count`

### Mark one as read

**PATCH** `/api/v1/notifications/:id/read`

### Mark all as read

**PATCH** `/api/v1/notifications/mark-all-read`

---

## 6) In-App Notifications (Real-time via Socket.IO)

Namespace:
- `/notifications`

Auth:
- Provide the JWT in the connection handshake, using either:
  - `auth: { token: <JWT> }`, or
  - `query: { token: <JWT> }`

Event:
- The server emits: `notification`
- It targets a user room named: `user_<userId>`

### Example (Socket.IO client)

```ts
import { io } from "socket.io-client";

const socket = io("<BASE_URL>/notifications", {
  auth: { token: "<TOKEN>" },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("notification", (payload) => {
  // payload: { id, eventType, severity, title, message, metadata, status, createdAt }
  console.log("notification", payload);
});

socket.on("disconnect", () => {
  console.log("disconnected");
});
```

---

## 7) Notification Event Types for Address/Logo

When the user updates address/logo using the endpoints above, the backend emits notifications with these `eventType` values:

- `INSTITUTION_ADDRESS_UPDATED`
  - Trigger: `PATCH /api/v1/tenant/address`
  - Metadata includes:
    - `tenantName`
    - `address` (the merged address object)
    - `isFirstSet` (boolean)

- `INSTITUTION_LOGO_UPDATED`
  - Trigger: `POST /api/v1/tenant/logo`
  - Metadata includes:
    - `tenantName`
    - `logoUrl`
    - `isFirstSet` (boolean)

Frontend recommendation:
- Use `metadata.isFirstSet` to power “stepwise onboarding” UI (e.g., show a stronger prompt when first set).

---

## 8) Common UI patterns

- On “Institution Settings” page load:
  1. Call `GET /api/v1/tenant/current`
  2. Populate forms from `tenant.config.address` and `tenant.config.branding.logoUrl`

- On save address:
  - Call `PATCH /api/v1/tenant/address`
  - Optimistically update UI; also listen for `INSTITUTION_ADDRESS_UPDATED` notification.

- On upload logo:
  - Call `POST /api/v1/tenant/logo` (multipart)
  - Update displayed logo from returned tenant config / refetch current tenant.
  - Listen for `INSTITUTION_LOGO_UPDATED` notification.
