# Department Head Status Enforcement Frontend Integration Guide

This guide explains how to integrate your existing frontend with the new backend enforcement flow:

- Department Head gets a **2-day grace period** after first successful login.
- Backend sends reminder notifications/emails before deadline.
- If no status document is uploaded in time, tenant is set to `SUSPENDED`.
- Suspended tenant users cannot log in.

---

## 1) Backend behavior you should rely on

### A) First login starts the timer

On first successful Department Head login, backend stores:

- `firstLoginAt`
- `statusUploadDeadline = firstLoginAt + 2 days`

This is done in auth login flow and does not require extra frontend calls.

### B) Reminder + suspension scheduler

A scheduler runs hourly and:

- Sends first reminder within deadline window.
- Sends second reminder close to deadline.
- Suspends tenant (`Tenant.status = SUSPENDED`) when overdue with no verification submission.

### C) Suspended tenants cannot log in

Login checks tenant status and blocks non-active tenants.
Expected login error message from backend:

- `Tenant account is not active`

---

## 2) Frontend integration points

## 2.1 Login handling

Endpoint:

- `POST /auth/login`

When login fails with `401` + message `Tenant account is not active`:

- Show a clear suspended/inactive institution screen.
- Disable normal app navigation.
- Show support/help CTA and reactivation instructions.

Recommended user-facing text:

- Title: `Institution account suspended`
- Body: `Your institution account is currently inactive because status verification is incomplete. Please contact support or complete verification if available.`

---

## 2.2 Session bootstrap (`/auth/me`)

Endpoint:

- `GET /auth/me`

Use this response to render current status context in UI:

- `data.tenant.status` (e.g. `ACTIVE`, `SUSPENDED`)
- `data.tenantVerification`:
  - `status`
  - `isPending`
  - `lastSubmittedAt`
  - `lastReviewedAt`
  - `lastReviewReason`

If `data.tenant.status !== 'ACTIVE'`:

- Redirect to suspended/inactive screen.
- Avoid loading normal dashboard modules.

---

## 2.3 Notifications UI integration

Endpoints:

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/mark-all-read`

The scheduler creates in-app notifications for:

- Reminder notices
- Suspension notice

Recommended frontend behavior:

- Poll `/notifications/unread-count` periodically (or use your existing socket strategy).
- Surface `CRITICAL` notifications as prominent banners/toasts.
- Deep-link reminder notifications to your verification upload page.

---

## 3) Frontend state model (recommended)

Add these fields to your auth/app store:

- `tenantStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | null`
- `tenantVerificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null`
- `tenantVerificationPending: boolean`
- `isTenantBlocked: boolean` (`tenantStatus !== 'ACTIVE'`)

State update sources:

- Login response + `/auth/me`
- Notification interactions

---

## 4) Guarding routes on frontend

Use a top-level route guard:

1. If no token -> login page.
2. If token exists, load `/auth/me`.
3. If `tenant.status !== 'ACTIVE'` -> suspended screen.
4. Else proceed to app.

This guarantees users cannot keep using UI with stale local state after backend suspension.

---

## 5) Error handling contract (important)

Your backend wraps errors consistently. Handle this shape:

```json
{
  "success": false,
  "message": "Tenant account is not active",
  "error": { "code": "Unauthorized" },
  "timestamp": "...",
  "path": "/api/v1/auth/login"
}
```

Frontend rule:

- Prefer `message` for user-facing mapping.
- Keep fallback generic message for unknown errors.

---

## 6) Suggested UX copy

### A) Reminder banner (while still active)

- `Your institution status document is required. Please upload it before the deadline to avoid suspension.`

### B) Suspended blocking page

- Header: `Institution account suspended`
- Body: `Your institution is temporarily inactive due to incomplete verification.`
- Actions:
  - `Contact support`
  - `Go to verification` (if your product allows recovery flow from suspended state)

---

## 7) End-to-end test checklist

1. Register Department Head institution.
2. Login first time -> timer starts (backend).
3. Do not upload verification -> wait/push scheduler window.
4. Confirm reminder appears in notifications and email inbox.
5. After deadline, confirm tenant becomes `SUSPENDED`.
6. Attempt login -> receives `Tenant account is not active`.
7. Frontend shows suspended screen.

---

## 8) Notes for your current implementation

- Email template IDs should be present in env:
  - `BREVO_STATUS_UPLOAD_REMINDER_TEMPLATE_ID`
  - `BREVO_STATUS_UPLOAD_SUSPENDED_TEMPLATE_ID`
- Scheduler is already wired through module imports and runs automatically with app runtime.
- No additional frontend endpoint is required to start the timer.

---

## 9) Minimal frontend pseudo-logic

```ts
// login.ts
try {
  const res = await api.post('/auth/login', payload);
  saveTokens(res.data.accessToken, res.data.refreshToken);
  const me = await api.get('/auth/me');

  if (me.data.data.tenant?.status !== 'ACTIVE') {
    navigate('/account-suspended');
    return;
  }

  navigate('/dashboard');
} catch (err: any) {
  const message = err?.response?.data?.message;
  if (message === 'Tenant account is not active') {
    navigate('/account-suspended');
    return;
  }
  showToast(message || 'Login failed');
}
```

This gives you deterministic behavior for both suspended-after-login and suspended-before-login cases.
