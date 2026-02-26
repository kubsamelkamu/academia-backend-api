# Admin Dashboard Integration Guide (Next.js) — Institution Verification Review

This guide shows how to integrate the **Platform Admin** review workflow for **institution verification requests**.

It assumes your Admin Dashboard already supports:

- Admin login (gets an access token)
- Attaching `Authorization: Bearer <accessToken>` to API calls

---

## Base URL

Backend dev defaults:

- API base: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`

In your Admin Next.js app, use:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1`

---

## Auth + Role requirement

All endpoints in this guide require:

- JWT header: `Authorization: Bearer <accessToken>`
- Role: `PLATFORM_ADMIN`

If the token is missing/invalid → `401`
If the token exists but user is not a Platform Admin → `403`

---

## Response format (important)

### Success (global transform wrapper)

Every successful response is wrapped like:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

### Error (global exception filter)

Errors are returned like:

```json
{
  "success": false,
  "message": "...",
  "error": { "code": "..." },
  "timestamp": "2026-02-26T12:00:00.000Z",
  "path": "/api/v1/..."
}
```

Common error codes you’ll see here:

- `UNAUTHORIZED` (401)
- `INSUFFICIENTPERMISSIONS` (403)
- `NOTFOUND` (404)
- `CONFLICT` (409)

---

## Step-by-step Admin integration

### Step 1) List requests (default is PENDING)

- **GET** `/admin/tenant-verification/requests`

Query params:

- `page` (optional, integer, min 1)
- `limit` (optional, integer, 1–100)
- `status` (optional enum: `PENDING | APPROVED | REJECTED`) — default is `PENDING`
- `tenantId` (optional string)

Examples:

- Pending queue (default):
  - `/admin/tenant-verification/requests`
- Approved history:
  - `/admin/tenant-verification/requests?status=APPROVED&page=1&limit=20`

Success `data` shape:

```json
{
  "items": [
    {
      "id": "req_...",
      "tenantId": "tenant_...",
      "status": "PENDING",
      "createdAt": "2026-02-26T11:58:00.000Z",
      "reviewedAt": null,
      "reviewReason": null,
      "fileName": "proof.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 2048,
      "tenant": {
        "id": "tenant_...",
        "name": "Addis Ababa University",
        "domain": "addisababauniversity",
        "status": "ACTIVE"
      },
      "submittedBy": {
        "id": "user_...",
        "email": "head@uni.edu",
        "firstName": "Dept",
        "lastName": "Head"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Admin UI suggestions:

- Default view: `status=PENDING`
- Tabs: `Pending`, `Approved`, `Rejected`
- Table columns: Institution, Submitted by, File type, Submitted at, Actions

---

### Step 2) Request details (for review screen)

- **GET** `/admin/tenant-verification/requests/:requestId`

Success `data` shape:

```json
{
  "id": "req_...",
  "tenantId": "tenant_...",
  "submittedByUserId": "user_...",
  "status": "PENDING",
  "documentUrl": "https://...",
  "documentPublicId": "tenant-verification/...",
  "fileName": "proof.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2048,
  "reviewedByUserId": null,
  "reviewedAt": null,
  "reviewReason": null,
  "createdAt": "2026-02-26T11:58:00.000Z",
  "updatedAt": "2026-02-26T11:58:00.000Z",
  "tenant": {
    "id": "tenant_...",
    "name": "Addis Ababa University",
    "domain": "addisababauniversity",
    "status": "ACTIVE"
  },
  "submittedBy": {
    "id": "user_...",
    "email": "head@uni.edu",
    "firstName": "Dept",
    "lastName": "Head"
  },
  "reviewedBy": null
}
```

Admin UI suggestions:

- “Open document” button using `documentUrl`
- Show file details: name, type, size
- Show institution name/domain and submitter email

---

### Step 3) Approve request

- **POST** `/admin/tenant-verification/requests/:requestId/approve`

Body:

```json
{ "reason": "Optional note (max 1000 chars)" }
```

Success:

- Returns the updated request (same shape as GET by id), with:
  - `status: "APPROVED"`
  - `reviewedAt` set
  - `reviewedByUserId` set
  - `reviewReason` set (or null)

Errors:

- `404 NOTFOUND`: request id doesn’t exist
- `409 CONFLICT`: request already reviewed (APPROVED/REJECTED)

---

### Step 4) Reject request

- **POST** `/admin/tenant-verification/requests/:requestId/reject`

Body (**reason is required**):

```json
{ "reason": "Explain why it was rejected (max 1000 chars)" }
```

Success:

- Returns the updated request with:
  - `status: "REJECTED"`
  - `reviewedAt` set
  - `reviewReason` set

Errors:

- `400 BADREQUEST`: reason missing/empty
- `404 NOTFOUND`: request id doesn’t exist
- `409 CONFLICT`: request already reviewed

Frontend UX note:

- Department Head sees the reason in `/auth/me` as `tenantVerification.lastReviewReason`.

---

## Optional: integrate Admin notifications deep-link

When a Department Head submits a document, Platform Admins receive an in-app notification with metadata:

- `metadata.adminPath = "/admin/tenant-verification/requests/<requestId>"`

If your admin dashboard has a notifications list, you can:

- Navigate to that `adminPath`
- Load the request detail screen and call `GET /admin/tenant-verification/requests/:requestId`

---

## Minimal Next.js fetch examples

```ts
type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
};

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.success) {
    const msg = (body as any)?.message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }

  return body.data;
}

export async function listVerificationRequests(accessToken: string, params?: {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  tenantId?: string;
}) {
  const usp = new URLSearchParams();
  if (params?.page) usp.set('page', String(params.page));
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.status) usp.set('status', params.status);
  if (params?.tenantId) usp.set('tenantId', params.tenantId);

  const qs = usp.toString();
  return apiFetch<{ items: any[]; meta: any }>(
    `/admin/tenant-verification/requests${qs ? `?${qs}` : ''}`,
    accessToken,
    { method: 'GET' }
  );
}

export async function approveVerification(accessToken: string, requestId: string, reason?: string) {
  return apiFetch<any>(`/admin/tenant-verification/requests/${requestId}/approve`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function rejectVerification(accessToken: string, requestId: string, reason: string) {
  return apiFetch<any>(`/admin/tenant-verification/requests/${requestId}/reject`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}
```

---

## Checklist

- [ ] Add “Institution Verification” menu item
- [ ] Implement list page (default `PENDING`)
- [ ] Implement detail/review page (GET by id)
- [ ] Implement approve + reject actions
- [ ] Handle `409 CONFLICT` by refreshing details and showing “Already reviewed”
- [ ] (Optional) Link notifications to `metadata.adminPath`
