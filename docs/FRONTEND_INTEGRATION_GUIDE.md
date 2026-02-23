# Frontend Integration Guide (Zustand)

This guide shows how to integrate **Institution Registration** (Department Head onboarding) with the backend in a clean, step-by-step flow using **Zustand** for state management.

## What you’re integrating (flow)

1. **Register Institution** (creates University + department + Department Head user)
2. Backend sends **Email Verification OTP** (Brevo template)
3. **Verify Email OTP** (activates the Department Head account)
4. **Login** (returns JWT access + refresh tokens)

---

## 1) Base URLs and API prefix

Backend defaults:

- API base (dev): `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`

Frontend URL (used in emails):

- `FRONTEND_URL=http://localhost:3000`

---

## 2) Key API endpoints (in order)

### A) Register Institution

- **POST** `/auth/register/institution`
- **HTTP**: `201 Created`

Request body matches `RegisterInstitutionDto`.

Note:

- `tenantDomain` is **not provided** during registration.
- The backend **auto-generates** a unique tenant domain from `universityName` and returns it as `data.institution.domain`.

Success response shape (note the wrapper):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "institution": { "id": "...", "name": "...", "domain": "..." },
    "department": { "id": "...", "name": "...", "code": "..." },
    "departmentHead": { "id": "...", "email": "...", "firstName": "...", "lastName": "..." },
    "nextSteps": ["..."]
  },
  "timestamp": "..."
}
```

Important:

- The Department Head account is created, but is **not active** until email verification.
- The backend sends an OTP email (Brevo template if configured).
- Save `data.institution.domain` in your Zustand store (this becomes the `tenantDomain` for OTP verify + login).

Common errors:

- `400` validation errors
- `409` email already registered
- `429` throttling

---

### B) Verify Email OTP

- **POST** `/auth/email-verification/verify`
- **HTTP**: `200 OK`

Body:

```json
{
  "email": "depthead@university.edu",
  "otp": "809807"
}
```

Notes:

- `tenantDomain` is optional for this endpoint. If omitted, the backend will infer the tenant from the email.
- For best UX, still keep `tenantDomain` in your app state (from registration response) and auto-fill it when needed.

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": { "verified": true, "message": "Email verified successfully" },
  "timestamp": "..."
}
```

Common errors:

- `400` invalid tenant domain, invalid/expired OTP, or too many attempts
- `429` throttling

---

### C) Resend OTP (optional)

- **POST** `/auth/email-verification/resend`
- **HTTP**: `200 OK`

Body:

```json
{
  "email": "depthead@university.edu"
}
```

Notes:

- Resend is throttled.

---

### D) Login

- **POST** `/auth/login`
- **HTTP**: `200 OK`

Body:

```json
{
  "email": "depthead@university.edu",
  "password": "YourPassword",
  "tenantDomain": "addisababauniversity6"
}
```

Curl troubleshooting:

- JSON must be valid (no trailing commas).
- `tenantDomain` is required for `/auth/login`.

Success (wrapper):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "roles": ["DepartmentHead"],
      "tenantId": "..."
    }
  },
  "timestamp": "..."
}
```

Common errors:

- `400` validation errors
- `401` invalid credentials / inactive account / inactive tenant
- `429` throttling

---

## 2.1) After login: role-based redirect + show user email

Your login response includes:

- `data.user.roles`: array of role names (e.g. `DepartmentHead`, `Student`)
- `data.user.email`: show this in the UI (Header/Sidebar)

Recommended flow:

1. Call login
2. Store `accessToken`, `refreshToken`, and `user` in Zustand
3. Redirect based on `user.roles`
4. Render `user.email` in Header/Sidebar

### Role-based redirect (example)

```ts
function hasRole(user: { roles: string[] } | undefined, role: string) {
  return !!user?.roles?.includes(role);
}

// Example route decision after login
export function getHomeRouteForUser(user: { roles: string[] } | undefined) {
  if (hasRole(user, 'DepartmentHead')) return '/department/dashboard';
  if (hasRole(user, 'Advisor')) return '/advisor/dashboard';
  if (hasRole(user, 'Coordinator')) return '/coordinator/dashboard';
  if (hasRole(user, 'Student')) return '/student/dashboard';
  return '/';
}
```

### Show user email in Header + Sidebar (example)

```ts
// Header.tsx / Sidebar.tsx
import { useAuthStore } from './stores/auth.store';

export function Header() {
  const email = useAuthStore((s) => s.user?.email);
  return (
    <header>
      <div>{email ?? '...'}</div>
    </header>
  );
}
```

Notes:

- For multi-tenant users, login requires `tenantDomain` (the university domain).
- The backend wraps all responses; always read `res.data.data`.

---

## 3) Handle the backend response wrapper (important)

All successful responses are wrapped like:

```ts
{ success: true; message: string; data: any; timestamp: string }
```

All errors are wrapped like:

```ts
{ success: false; message: string | string[]; error: { code: string }; timestamp: string; path: string }
```

So in the frontend, **always read `response.data.data`** for the real payload.

---

## 4) Recommended Zustand state design

You have two concerns:

1) **Onboarding state** (temporary): store `tenantDomain`, email used, and “pending verification”.
2) **Auth state** (persistent): store tokens and user.

Minimal state shape:

```ts
type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  tenantId: string;
};

type RegisterResult = {
  institution: { id: string; name: string; domain: string };
  department: { id: string; name: string; code: string };
  departmentHead: { id: string; email: string; firstName: string; lastName: string; role: string };
  nextSteps: string[];
};

type AuthState = {
  tenantDomain?: string;
  pendingEmailVerification?: boolean;
  registration?: RegisterResult;

  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;

  registerInstitution: (dto: any) => Promise<RegisterResult>;
  verifyEmailOtp: (payload: { email: string; otp: string; tenantDomain?: string }) => Promise<void>;
  resendEmailOtp: (payload: { email: string; tenantDomain?: string }) => Promise<void>;
  login: (payload: { email: string; password: string; tenantDomain?: string }) => Promise<void>;
  logout: () => void;
};
```

Persistence:

- Persist `tenantDomain`, `refreshToken` (and optionally `accessToken`).
- Keep `registration` optional (useful for showing “next steps”).

---

## 5) API client helper (Axios or fetch)

### Option A: Axios helper

```ts
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001/api/v1",
});

export async function apiPost<TData>(url: string, body: unknown, token?: string): Promise<TData> {
  const res = await api.post(url, body, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  // unwrap backend envelope
  return res.data.data as TData;
}
```

### Option B: fetch helper

```ts
export async function apiPost<TData>(url: string, body: unknown, token?: string): Promise<TData> {
  const res = await fetch(`http://localhost:3001/api/v1${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    // backend sends { success:false, message, error:{code} }
    const message = Array.isArray(json?.message) ? json.message.join(", ") : json?.message;
    throw new Error(message || "Request failed");
  }

  return json.data as TData;
}
```

---

## 6) Step-by-step UI integration

### Screen 1: Institution Registration

Inputs (typical):

- Institution name
- Department name
- Department code
- Department Head: first name, last name, email, password

Domain behavior:

- You do **not** ask for `tenantDomain` on this screen.
- After successful registration, show the generated domain (from `data.institution.domain`) and store it for the next steps.

On submit:

1. Call `registerInstitution(dto)`
2. On success:
   - store `tenantDomain = result.institution.domain`
   - store `registration = result`
   - set `pendingEmailVerification = true`
3. Navigate to OTP screen

---

### Screen 2: Verify Email OTP

Inputs:

- Email (prefill from registration)
- OTP

On submit:

1. Call `verifyEmailOtp({ email, otp })` (store provides tenantDomain)
2. On success:
   - set `pendingEmailVerification = false`
   - navigate to Login

Resend:

- Call `resendEmailOtp({ email })`

---

### Screen 3: Login

Inputs:

- tenantDomain (prefilled from store)
- email
- password

On submit:

1. Call `login({ email, password })`
2. On success:
   - store tokens + user
   - route to Department Head dashboard

---

## 7) Common UX tips (based on multi-tenant)

- After registration, don’t ask the user to retype tenant domain—use the domain from the register response.
- Also show tenant domain in UI as a “Your institution domain is: …” line.
- For login, keep tenant domain as a required field (unless you later add a secure tenant-discovery endpoint).

---

## 8) Checklist for first end-to-end test

1. Submit register form → expect `201` and OTP email is received.
2. Use OTP + tenantDomain to verify → expect `200` verified.
3. Login with tenantDomain + email + password → expect tokens.

---

## Next

If you share your frontend stack (**Next.js** vs **Vite React**) and whether you want tokens in **localStorage** or **cookies**, we can generate the exact Zustand store and API client files ready to paste into your frontend repo.
