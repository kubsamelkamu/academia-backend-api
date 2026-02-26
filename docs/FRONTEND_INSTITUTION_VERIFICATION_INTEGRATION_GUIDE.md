# Frontend Integration Guide (Next.js) — Institution Verification (Department Head)

This guide covers the **Department Head institution verification** flow after you already integrated:

1) Register institution
2) Verify email OTP
3) Login

(Those are documented in `docs/FRONTEND_INTEGRATION_GUIDE.md`.)

---

## What you’re integrating (Department Head)

After login, a Department Head should be able to:

1) See their verification status badge (NOT SUBMITTED / PENDING / APPROVED / REJECTED)
2) Upload a verification document (PDF/JPG/PNG, max 10MB)
3) If rejected, see the rejection reason and resubmit

Important backend decision:

- Verification does **not** block tenant access.
- It is tracked separately via `TenantVerificationRequest` statuses.

---

## Response format (important)

Most endpoints in this backend return a standard envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

On errors, you typically get:

```json
{
  "success": false,
  "message": "Error message (string) OR validation errors (string[])",
  "error": { "code": "BADREQUEST" },
  "timestamp": "2026-02-25T12:00:00.000Z",
  "path": "/api/v1/..."
}
```

---

## When to prompt upload (first-time UX)

You said: “for first time ask them to upload doc after verifying OTP”.

Backend note:

- The upload endpoint requires the user to be authenticated (JWT) and email-verified.
- The OTP verify endpoint does **not** return tokens, so the usual sequence is:
  1) Verify OTP
  2) Login
  3) Prompt/redirect to upload document

Recommended UX:

- After OTP verification succeeds, show an “Email verified” success step.
- Send them to Login (or auto-login if your frontend stored the credentials during registration).
- Immediately after login, call `/auth/me` and if `tenantVerification.status` is `null` or `REJECTED`, redirect them to your upload page.

Redirect rule (Department Head only):

- If `tenantVerification.status === null` → redirect to `/department/verify-institution`
- If `tenantVerification.status === 'REJECTED'` → redirect to `/department/verify-institution` (show reason)
- If `tenantVerification.status === 'PENDING'` → show “Pending review” info page/badge (no upload)
- If `tenantVerification.status === 'APPROVED'` → proceed normally

---

## Base URL

Backend dev defaults:

- API base: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`

In Next.js, define:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1`

---

## Key endpoints

This section focuses on the Department Head verification onboarding right after OTP verification.

### A) Verify Email OTP (activates account)

- **POST** `/auth/email-verification/verify`
- **HTTP**: `200 OK`
- **Auth**: Public

Request body:

```json
{
  "email": "depthead@university.edu",
  "otp": "809807"
}
```

Success response:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "verified": true,
    "message": "Email verified successfully"
  },
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

Common errors:

- `400` invalid/expired OTP
- `429` throttled

### B) Login (get tokens)

- **POST** `/auth/login`
- **HTTP**: `200 OK`
- **Auth**: Public

Request body:

```json
{
  "email": "depthead@university.edu",
  "password": "YourPassword",
  "tenantDomain": "addisababauniversity6"
}
```

Success response (envelope):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "user-id",
      "email": "depthead@university.edu",
      "firstName": "John",
      "lastName": "Smith",
      "avatarUrl": null,
      "roles": ["DepartmentHead"],
      "tenantId": "tenant-id"
    }
  },
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

Common errors:

- `401` invalid credentials / inactive account / inactive tenant

### C) First-time prompt: route user to upload after OTP verify

Backend requirement:

- The document upload endpoint rejects if the user’s `emailVerified` is `false`.

Recommended UX after OTP verify:

1) OTP verify success → show “Email verified” screen
2) Continue → login (or auto-login)
3) Immediately call `/auth/me`
4) If `tenantVerification.status === null`, route to your upload page (example: `/department/verify-institution`)

### 1) Get current session and verification badge

- **GET** `/auth/me`
- **Auth**: `Authorization: Bearer <accessToken>`

Success response (envelope) includes `data.tenantVerification`:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "user-id",
    "email": "depthead@university.edu",
    "roles": ["DepartmentHead"],
    "tenantId": "tenant-id",
    "tenantVerification": {
      "status": "PENDING",
      "isPending": true,
      "lastSubmittedAt": "2026-02-25T12:00:00.000Z",
      "lastReviewedAt": null,
      "lastReviewReason": null
    }
  },
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

The `tenantVerification` fields:

- `data.tenantVerification.status` → `PENDING | APPROVED | REJECTED | null`
- `data.tenantVerification.isPending` → boolean
- `data.tenantVerification.lastSubmittedAt`
- `data.tenantVerification.lastReviewedAt`
- `data.tenantVerification.lastReviewReason`

Recommended UI mapping:

- `status === null` → show "Not submitted" + CTA button "Verify Institution"
- `status === 'PENDING'` → show "Pending review" + info text
- `status === 'APPROVED'` → show "Verified" + optional success message
- `status === 'REJECTED'` → show "Rejected" + show `lastReviewReason` + CTA "Resubmit"

If you want the “first-time prompt” behavior, treat `status === null` as an onboarding requirement for Department Heads and redirect them to the upload page right after login.

### 2) Submit verification document

- **POST** `/tenant/verification/document`
- **Auth**: `Authorization: Bearer <accessToken>`
- **Content-Type**: `multipart/form-data`

Form field:

- `document`: the file

Constraints:

- Allowed types: `application/pdf`, `image/jpeg`, `image/png`
- Max size: 10MB

Success:

- Returns the created verification request with `status: 'PENDING'` inside the standard envelope.

Example success response:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "req-id",
    "tenantId": "tenant-id",
    "submittedByUserId": "user-id",
    "status": "PENDING",
    "documentUrl": "https://res.cloudinary.com/...",
    "fileName": "proof.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 2048,
    "createdAt": "2026-02-25T12:00:00.000Z"
  },
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

Common errors:

- `400` invalid file type / missing file / email not verified
- `401` missing/invalid token
- `403` user is not a Department Head

After success, the frontend should:

1) Show toast “Submitted for review”
2) Immediately call `/auth/me` again to refresh badge state

---

## What happens after REJECTED (frontend expectation)

When Platform Admin rejects a request:

- `/auth/me` returns `tenantVerification.status === 'REJECTED'`
- `/auth/me` returns `tenantVerification.lastReviewReason` (show this prominently)
- Department Head receives an in-app notification + email (best-effort)

Resubmission behavior:

- The user uploads again using the **same** `POST /tenant/verification/document` endpoint.
- A **new** request is created with `PENDING`.
- `/auth/me` always reflects the **latest** request.

---

## Next.js implementation (minimal)

### 1) API helper

Create a small helper that:

- Uses `NEXT_PUBLIC_API_BASE_URL`
- Attaches bearer token
- Parses the backend wrapper response (`{ success, message, data, timestamp }`)

Example:

```ts
// lib/apiClient.ts
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  if (!API_BASE) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body?.success) {
    // backend error format may vary slightly; keep it simple for UI
    const msg = (body as any)?.message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }

  return body.data;
}
```

### 2) Fetch the badge state

```ts
// lib/verification.ts
import { apiFetch } from './apiClient';

export type MeResponse = {
  id: string;
  email: string;
  roles: string[];
  tenantVerification: null | {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    isPending: boolean;
    lastSubmittedAt: string | null;
    lastReviewedAt: string | null;
    lastReviewReason: string | null;
  };
};

export async function getMe(accessToken: string) {
  return apiFetch<MeResponse>('/auth/me', { method: 'GET', accessToken });
}
```

After login, apply a simple redirect guard:

```ts
export function shouldForceVerificationUpload(me: MeResponse) {
  const isDeptHead = me.roles?.includes('DepartmentHead');
  if (!isDeptHead) return false;

  const status = me.tenantVerification?.status;
  return status === null || status === 'REJECTED';
}
```

### 3) Upload the document

```ts
import { apiFetch } from './apiClient';

export type VerificationRequest = {
  id: string;
  status: 'PENDING';
  documentUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  createdAt: string;
};

export async function submitVerificationDocument(accessToken: string, file: File) {
  const formData = new FormData();
  formData.append('document', file);

  return apiFetch<VerificationRequest>('/tenant/verification/document', {
    method: 'POST',
    body: formData,
    accessToken,
    // NOTE: Do not set Content-Type manually for FormData.
  });
}
```

Suggested client UX:

- Validate file type/size in the browser before upload
- Disable submit button while uploading
- On success, call `getMe()` again and update the badge

---

## Notifications (optional, but recommended)

If your Department Head UI shows notifications, use the existing guide:

- `docs/FRONTEND_PROFILE_NOTIFICATIONS_INTEGRATION_GUIDE.md`

For verification events, you will see types like:

- `INSTITUTION_VERIFICATION_SUBMITTED`
- `INSTITUTION_VERIFICATION_APPROVED`
- `INSTITUTION_VERIFICATION_REJECTED`

---

## Quick checklist

- [ ] After login, call `/auth/me` and show `tenantVerification` badge
- [ ] Create a “Verify Institution” page with file upload
- [ ] Submit file to `POST /tenant/verification/document`
- [ ] Handle `REJECTED` by showing reason and allowing resubmission
- [ ] Refresh `/auth/me` after submission and after app reload
