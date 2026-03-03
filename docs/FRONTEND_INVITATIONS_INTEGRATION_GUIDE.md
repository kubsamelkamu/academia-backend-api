# Frontend Integration Guide: Invitations (Department Head → Users)

This document describes how to integrate the **Department Head invitation flow** with the backend API:

- Invite a single user (Student / Advisor / Coordinator)
- Bulk invite Students (sync)
- Bulk invite Students (async job)
- List / resend / revoke invitations
- Public accept endpoint (creates user and returns a **temporary password once**)
- Login and forced password change (`mustChangePassword`)

---

## 1) Base URL + versioning

- Base URL (local): `http://localhost:3001`
- API prefix + versioning (default): `/api/v1`
- Swagger: `http://localhost:3001/api/docs`

All routes below are shown with the full prefix, e.g. `GET /api/v1/tenant/invitations`.

---

## 2) Auth header + roles

All Department Head invitation endpoints require:

- Header: `Authorization: Bearer <ACCESS_TOKEN>`
- Role: `DepartmentHead`

Public acceptance endpoint does **not** require auth.

---

## 3) High-level frontend flow (recommended)

### A) Department Head sends invitations

1. Department Head logs in
2. Department Head invites one user OR bulk-invites students
3. Backend sends invitation email (Brevo template or fallback HTML)

### B) Invitee accepts invitation

1. Invitee clicks **Accept invitation** in email (frontend page)
2. Frontend page calls `POST /api/v1/invitations/accept/preview` to fetch invitation details
3. Frontend displays the invited identity (`firstName`/`lastName`) as **read-only** and asks the user to confirm
4. On confirm, frontend calls `POST /api/v1/invitations/accept`
5. Backend returns `temporaryPassword` (shown **once**) and `mustChangePassword: true`

### C) Invitee logs in and is forced to change password

1. Frontend navigates to Login
2. Frontend logs in with email + `temporaryPassword`
3. Backend login response includes `user.mustChangePassword: true`
4. Frontend forces redirect to “Change password” screen
5. Frontend calls `POST /api/v1/auth/change-password`
6. After successful change, user logs in again (or you can refresh `/auth/me`)

---

## 4) Response wrapper shape

Most endpoints use a standard response wrapper:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-03-02T18:19:11.868Z"
}
```

Errors typically look like:

```json
{
  "success": false,
  "message": "Reason for failure",
  "error": { "code": "BADREQUEST" },
  "timestamp": "2026-03-02T18:19:11.868Z",
  "path": "/api/v1/..."
}
```

Frontend rule:
- Prefer backend `message` for user-facing feedback.
- Map specific known messages to friendly UX (optional).

---

## 5) Department Head Invitation APIs

### 5.0) Optional email customization (Slack-like)

The Department Head can optionally customize the invitation email (safely) using:

- `subject` (plain text)
- `message` (plain text)
- `messageTemplateId` (a saved preset)

Rules:

- These values are **send-time only** (not stored on the Invitation).
- If `messageTemplateId` is provided, the backend loads that preset from the Department Head’s department.
- Explicit `subject` / `message` in the request override the preset values.

You can also preview the backend-rendered fallback HTML/text before sending.

### 5.1) Create a single invitation

Invite **one** user to join the Department Head’s department.

- **POST** `/api/v1/tenant/invitations`
- **Auth**: DepartmentHead
- **201 Created**

Request body:

```json
{
  "email": "student@university.edu",
  "firstName": "Kubsa",
  "lastName": "Melkami",
  "roleName": "Student",
  "messageTemplateId": "optional-template-id",
  "subject": "Optional custom subject",
  "message": "Optional custom message (plain text)"
}
```

Allowed roleName values:
- `Student`
- `Advisor`
- `Coordinator`

Common errors:
- `400` invalid payload
- `401` missing/invalid token
- `403` not DepartmentHead
- `409` user already exists

---

### 5.2) Bulk invite students (synchronous)

Bulk invite Students in one request.

- **POST** `/api/v1/tenant/invitations/bulk`
- **Auth**: DepartmentHead
- **200 OK**
- **Limits**:
  - Max 50 invites per request
  - Throttled (rate limited)

Request body:

```json
{
  "invites": [
    { "email": "student1@university.edu", "firstName": "Abebe", "lastName": "Kebede" },
    { "email": "student2@university.edu", "firstName": "Almaz", "lastName": "Tesfaye" }
  ],
  "messageTemplateId": "optional-template-id",
  "subject": "Optional custom subject (applies to all)",
  "message": "Optional custom message (applies to all)"
}
```

Success response (example shape):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "requested": 2,
    "unique": 2,
    "created": 2,
    "skippedExisting": 0,
    "duplicates": [],
    "invitations": [
      {
        "id": "invitation-id",
        "tenantId": "tenant-id",
        "departmentId": "department-id",
        "email": "student1@university.edu",
        "firstName": "Abebe",
        "lastName": "Kebede",
        "roleName": "Student",
        "status": "PENDING",
        "expiresAt": "2026-03-09T10:00:00.000Z",
        "createdAt": "2026-03-02T10:00:00.000Z",
        "acceptedAt": null,
        "revokedAt": null,
        "lastSentAt": "2026-03-02T10:00:01.000Z",
        "sendCount": 1,
        "lastSendError": null
      }
    ]
  },
  "timestamp": "..."
}
```

Common errors:
- `400` if more than 50, invalid invites, or inviter has no department
- `429` rate limited

Frontend UX suggestions:
- Show summary counts: requested / created / skippedExisting / duplicates
- Show per-email send failure only if exposed (e.g. `lastSendError`)

---

### 5.3) Bulk invite students (asynchronous job)

Use this when you want the backend worker to process the bulk invite job.

- **POST** `/api/v1/tenant/invitations/bulk/jobs`
- **Auth**: DepartmentHead
- **202 Accepted**
- **Limits**:
  - Max 50 invites per request
  - Throttled (rate limited)

Request body:

```json
{
  "invites": [
    { "email": "student1@university.edu", "firstName": "Abebe", "lastName": "Kebede" },
    { "email": "student2@university.edu", "firstName": "Almaz", "lastName": "Tesfaye" }
  ],
  "messageTemplateId": "optional-template-id",
  "subject": "Optional custom subject (applies to all)",
  "message": "Optional custom message (applies to all)"
}
```

Success response (202 Accepted):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "jobId": "123",
    "enqueued": true,
    "requested": 2,
    "maxPerRequest": 50
  },
  "timestamp": "..."
}
```

---

### 5.4) Preview invitation email (before sending)

Generate a preview of the backend fallback HTML/text. The UI can render `htmlContent`.

- **POST** `/api/v1/tenant/invitations/preview`
- **Auth**: DepartmentHead
- **200 OK**

Request body:

```json
{
  "roleName": "Student",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "messageTemplateId": "optional-template-id",
  "subject": "Optional custom subject",
  "message": "Optional custom message (plain text)"
}
```

Notes:
- `firstName` / `lastName` are optional **only for preview**.
- If you do not send them, the preview greeting will render as `Hi,`.
- When sending real invitations, the greeting comes from the invitation record (created with `firstName`/`lastName`).

Frontend integration checklist (preview):
- Ensure your request JSON body uses `firstName` and `lastName` (not `inviteeFirstName` / `inviteeLastName`).
- Verify the request is sent to `POST /api/v1/tenant/invitations/preview`.

Response (example):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "subject": "You're invited to join Academia",
    "htmlContent": "<!doctype html><html lang=\"en\">...",
    "textContent": "Hello,\n\nYou have been invited...",
    "acceptUrl": "http://localhost:3000/invitations/accept?token=preview-token",
    "loginUrl": "http://localhost:3000/login?tenantDomain=example",
    "expiresAt": "2026-03-09T10:00:00.000Z"
  },
  "timestamp": "..."
}
```

Frontend rendering (recommended):

- Render `data.htmlContent` inside an `iframe` using `srcDoc`.
- This keeps email CSS isolated from your app CSS.

React example:

```tsx
type PreviewResponse = {
  success: boolean;
  message: string;
  data: {
    subject: string;
    htmlContent: string;
    textContent: string;
    acceptUrl: string;
    loginUrl: string;
    expiresAt: string;
  };
};

function InvitationEmailPreview({ preview }: { preview: PreviewResponse | null }) {
  if (!preview?.data) return null;

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{preview.data.subject}</div>

      <iframe
        title="Invitation email preview"
        style={{ width: '100%', height: 720, border: 0, background: '#fff' }}
        // sandbox keeps it safer; links still work in most browsers with user activation
        sandbox="allow-popups allow-top-navigation-by-user-activation"
        srcDoc={preview.data.htmlContent}
      />


    ---

    ### 5.3.1) Import students from CSV/Excel (frontend-only, no backend changes)

    If you want to invite more than 50 students without typing them manually, implement a **file import UI** in the frontend.

    Important:
    - The backend bulk invite endpoints still accept **max 50 invites per request**.
    - The frontend should parse the file, validate rows, then **send in batches of 50** using the existing endpoints.
    - This import flow is **Student-only**. The frontend should set `roleName: "Student"` (do not put role in the file).

    #### A) File templates (what the user uploads)

    Support both:
    - CSV file (`.csv`)
    - Excel file (`.xlsx`) (read the first worksheet)

    Required columns (header row):
    - `email`
    - `firstName`
    - `lastName`

    Rules:
    - Header matching should be case-insensitive (e.g. `FirstName` is acceptable).
    - Extra columns may be ignored.
    - Empty rows should be ignored.

    Example CSV:

    ```csv
    email,firstName,lastName
    student1@university.edu,Abebe,Kebede
    student2@university.edu,Almaz,Tesfaye
    ```

    #### B) Frontend parsing (recommended libraries)

    - CSV parsing: `papaparse`
    - Excel parsing: `xlsx` (SheetJS)

    The output of parsing should be a uniform array:

    ```ts
    type ImportedStudentRow = {
      rowNumber: number; // 1-based line number in CSV or sheet row index
      email: string;
      firstName: string;
      lastName: string;
    };
    ```

    #### C) Frontend validation + normalization

    For each parsed row:
    - `email = email.trim().toLowerCase()`
    - `firstName = firstName.trim()`
    - `lastName = lastName.trim()`

    Validate:
    - email is present and looks like an email
    - firstName and lastName are present

    Deduplicate:
    - Deduplicate by normalized email
    - If duplicates exist, keep the first and mark the rest as invalid (recommended)

    Produce two arrays:
    - `validInvites: Array<{ email: string; firstName: string; lastName: string }>`
    - `invalidRows: Array<{ rowNumber: number; reason: string }>`

    #### D) Review screen UX (before sending)

    Show:
    - total rows parsed
    - valid rows count
    - invalid rows count + table (row number + reason)

    Only enable “Send invitations” if `validInvites.length > 0`.

    #### E) Sending in batches of 50 (uses existing endpoints)

    Split the valid invites into chunks of 50 and send sequentially to reduce throttling risk.

    You can choose either:

    1) Synchronous bulk API (immediate results per batch)
    - `POST /api/v1/tenant/invitations/bulk`

    2) Async job API (recommended for large imports)
    - `POST /api/v1/tenant/invitations/bulk/jobs`
    - Poll each job using `GET /api/v1/tenant/invitations/bulk/jobs/:jobId`

    Batch request body (same for both sync/async):

    ```json
    {
      "invites": [
        { "email": "student1@university.edu", "firstName": "Abebe", "lastName": "Kebede" }
      ],
      "messageTemplateId": "optional-template-id",
      "subject": "Optional custom subject (applies to this batch)",
      "message": "Optional custom message (applies to this batch)"
    }
    ```

    Frontend notes:
    - Keep `messageTemplateId` / `subject` / `message` constant across all batches (recommended).
    - Show progress like: `Batch 3/12`.
    - If a batch request fails (network/429/etc), pause and allow retry for that batch.

    Pseudocode (chunking):

    ```ts
    function chunk<T>(items: T[], size: number): T[][] {
      const out: T[][] = [];
      for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
      return out;
    }

    const batches = chunk(validInvites, 50);
    for (const batch of batches) {
      // call POST /tenant/invitations/bulk OR /tenant/invitations/bulk/jobs
    }
    ```
      {/* Optional: show text fallback */}
      {/* <pre style={{ whiteSpace: 'pre-wrap' }}>{preview.data.textContent}</pre> */}
    </div>
  );
}
```

---

### 5.5) Saved invitation message templates (presets)

These endpoints allow the Department Head to manage reusable presets.

#### Create a preset

- **POST** `/api/v1/tenant/invitations/message-templates`
- **Auth**: DepartmentHead
- **201 Created**

```json
{
  "name": "Default invite note",
  "subject": "Optional subject",
  "message": "Optional message (plain text)"
}
```

#### List presets

- **GET** `/api/v1/tenant/invitations/message-templates`
- **Auth**: DepartmentHead
- **200 OK**

#### Update a preset

- **PATCH** `/api/v1/tenant/invitations/message-templates/:id`
- **Auth**: DepartmentHead
- **200 OK**

```json
{
  "name": "Updated name",
  "subject": "Updated subject",
  "message": "Updated message"
}
```

#### Delete a preset

- **DELETE** `/api/v1/tenant/invitations/message-templates/:id`
- **Auth**: DepartmentHead
- **200 OK**

#### Poll job status/result

- **GET** `/api/v1/tenant/invitations/bulk/jobs/:jobId`
- **Auth**: DepartmentHead
- **200 OK**

Response includes:
- `state`: `waiting` | `active` | `completed` | `failed` | ...
- `progress`: structured progress (step/sent/failures)
- `result`: only present when `state === 'completed'`

Frontend polling recommendation:
- Poll every 1–2 seconds until `completed` or `failed`
- Then show final `result` summary

Common errors:
- `404` job not found (or belongs to different tenant/department)
- `429` rate limited

---

### 5.6) List invitations for your department

- **GET** `/api/v1/tenant/invitations`
- **Auth**: DepartmentHead
- **200 OK**

Optional query:
- `status`: `PENDING` | `ACCEPTED` | `EXPIRED` | `REVOKED`

Example:
- `GET /api/v1/tenant/invitations?status=PENDING`

Notes:
- Each invitation item includes the invited identity as `firstName` / `lastName` (taken from the invitation record).

---

### 5.7) Revoke an invitation

Revoking invalidates the invite link.

- **DELETE** `/api/v1/tenant/invitations/:id`
- **Auth**: DepartmentHead
- **200 OK**

Common errors:
- `404` invitation not found
- `403` not allowed

---

### 5.8) Resend an invitation (rotates token + extends expiry)

Resend will:
- revoke the old pending invite
- create a new invite with a new token
- extend expiry

- **POST** `/api/v1/tenant/invitations/:id/resend`
- **Auth**: DepartmentHead
- **200 OK**

Common errors:
- `400` cannot resend accepted/revoked invitation
- `404` invitation not found

Frontend UX suggestion:
- Show “Invitation resent” and refresh list.

---

## 6) Public acceptance API (creates user + returns temporary password once)

### 6.1) Preview invitation (confirm screen)

Use this to show invitation details on the public “Confirm invitation” screen.

- **POST** `/api/v1/invitations/accept/preview`
- **Public**
- **200 OK**

Request body:

```json
{
  "token": "<invitation-token>"
}
```

Response includes (example fields):
- invited `firstName` / `lastName` (read-only)
- `email`, `roleName`, `tenantName`, `departmentName`
- `expiresAt`

Example response:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "invitationId": "invitation-id",
    "tenantId": "tenant-id",
    "tenantName": "Academia",
    "tenantDomain": "example",
    "departmentId": "department-id",
    "departmentName": "Software Engineering",
    "email": "student1@university.edu",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "roleName": "Student",
    "status": "PENDING",
    "expiresAt": "2026-03-09T10:00:00.000Z"
  },
  "timestamp": "..."
}
```

---

### 6.2) Accept invitation

- **POST** `/api/v1/invitations/accept`
- **Public**
- **200 OK**

Request body:

```json
{
  "token": "<invitation-token>"
}
```

Success response (example):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accepted": true,
    "userId": "user-id",
    "tenantId": "tenant-id",
    "email": "student1@academia.et",
    "temporaryPassword": "qtR0Duc3PxDr",
    "mustChangePassword": true,
    "updatedDepartmentIds": []
  },
  "timestamp": "..."
}
```

Important frontend rules:
- `temporaryPassword` is shown **once**. The backend will not email it.
- Display it immediately on a confirmation page.
- Provide a “Copy” button and then navigate user to Login.

Common errors:
- `400` invalid token, expired/revoked invitation, already accepted, email already in use
- `429` rate limited

---

## 7) Auth endpoints used in this flow

### 7.1) Login

- **POST** `/api/v1/auth/login`
- **200 OK**

Body:

```json
{
  "email": "student1@academia.et",
  "password": "qtR0Duc3PxDr",
  "tenantDomain": "haramayauniversity"
}
```

Notes:
- `tenantDomain` is optional in the DTO. If omitted, backend may infer tenant (emails are globally unique). For best UX, include `tenantDomain`.

Success response includes:
- `data.accessToken`
- `data.refreshToken`
- `data.user.mustChangePassword`

Frontend rule:
- If `user.mustChangePassword === true`, force redirect to change-password screen.

Common errors:
- `401` invalid credentials, inactive tenant, inactive user
- `429` rate limited

---

### 7.2) Change password (clears mustChangePassword)

- **POST** `/api/v1/auth/change-password`
- **Auth**: any logged-in user
- **200 OK**

Body:

```json
{
  "oldPassword": "qtR0Duc3PxDr",
  "newPassword": "NewStrongPass@12345"
}
```

Expected behavior:
- Backend updates password
- Backend clears `mustChangePassword` for the user

After changing password:
- You can re-login and confirm `mustChangePassword: false`
- Or call `GET /api/v1/auth/me` to confirm session profile

---

## 8) Frontend screens checklist (minimal)

1. **Invite Users** (Department Head)
   - Single invite form
  - Bulk invite form (collect `email`, `firstName`, `lastName` per row; max 50)
   - Result summary + invitation list

2. **Accept Invitation** (Public)
   - Read token from URL query `?token=...`
  - Call preview endpoint and display invited name as read-only
  - User confirms, then call accept endpoint
   - Show `temporaryPassword` once

3. **Login**
   - Email + password (+ optional tenant domain)
   - If `mustChangePassword`, redirect to Change Password

4. **Change Password**
   - Call change-password endpoint
   - Then navigate to user dashboard

---

