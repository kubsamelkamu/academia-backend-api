# Admin Dashboard Frontend Integration Guide (Zustand)

This guide shows how to integrate your **Admin Dashboard** frontend with this backend in a clean, step-by-step flow using **Zustand** for state management.

For the **exact endpoint list** (with sample request/response payloads), see: `docs/ADMIN_DASHBOARD_API_REFERENCE.md`.

Scope (Option A):

- Tenants table uses: `GET /admin/tenants`
- Tenant detail page uses: `GET /admin/tenants/:tenantId/overview`
- Admin edits address using: `PATCH /admin/tenants/:tenantId/address`
- Admin updates tenant status using: `PATCH /admin/tenants/:tenantId/status`

---

## 1) Base URL + API prefix

The backend is versioned.

- API base (dev): `http://localhost:3001/api/v1`
- Swagger (dev): `http://localhost:3001/api/docs`

Frontend should always call paths under `/api/v1/...`.

---

## 2) Response wrapper you must handle

Successful responses are wrapped by the backend interceptor:

```json
{
  "success": true,
  "message": "Success",
  "data": { "...": "..." },
  "timestamp": "2026-02-21T10:30:00.000Z"
}
```

Errors are also wrapped consistently:

```json
{
  "success": false,
  "message": "Human readable error",
  "error": { "code": "ERROR_CODE", "details": {} },
  "timestamp": "2026-02-21T10:30:00.000Z",
  "path": "/api/v1/admin/tenants"
}
```

---

## 3) Key Admin API endpoints

### A) Admin login

- `POST /admin/auth/login`

Request body is the same `LoginDto` used by normal auth:

```json
{ "email": "admin@yourdomain.com", "password": "..." }
```

Possible success shapes:

1) Normal login (2FA not enabled)

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "roles": ["PlatformAdmin"], "tenantId": "system" }
}
```

2) Staged login (2FA enabled)

```json
{ "requiresTwoFactor": true, "twoFactorToken": "..." }
```

If `requiresTwoFactor === true`, complete using:

- `POST /admin/auth/login/2fa`

```json
{ "twoFactorToken": "...", "code": "123456", "method": "totp" }
```

### B) Refresh token

- `POST /admin/auth/refresh`

```json
{ "refreshToken": "..." }
```

### C) Tenants list

### C) Tenants list — `GET /admin/tenants`

Purpose: return a paginated list of tenants for the admin table. Supports search, pagination and status filtering.

Query params:
- `page` (number, default 1)
- `limit` (number, default 10)
- `search` (string, optional) — searches name/domain
- `status` (string, optional) — one of `TRIAL|ACTIVE|SUSPENDED|CANCELLED`

Example request:

`GET /admin/tenants?page=1&limit=10&search=addis&status=ACTIVE`

Example success response (200):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "tnt_123",
        "name": "Addis University",
        "domain": "aau.edu.et",
        "status": "ACTIVE",
        "onboardingDate": "2025-09-01T00:00:00.000Z",
        "createdAt": "2025-09-01T00:00:00.000Z",
        "updatedAt": "2025-10-01T00:00:00.000Z"
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  },
  "timestamp": "2026-02-23T10:30:00.000Z"
}
```

Errors:
- `401 Unauthorized` — missing/invalid token
- `403 Forbidden` — insufficient role
- `400 Bad Request` — invalid query param

---

### D) Tenant detail (overview) — `GET /admin/tenants/:tenantId/overview`

Purpose: return tenant metadata, address, creator and aggregated stats useful for the tenant detail page.

Query params:
- `includeInactive` (boolean) — include inactive users in counts
- `roleName` (string) — optional role to filter counts (e.g., `Student`, `Advisor`)

Example request:

`GET /admin/tenants/tnt_123/overview?includeInactive=true&roleName=Student`

Example success response (200):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "tenant": {
      "id": "tnt_123",
      "name": "Addis University",
      "domain": "aau.edu.et",
      "status": "ACTIVE",
      "onboardingDate": "2025-09-01T00:00:00.000Z",
      "createdAt": "2025-09-01T00:00:00.000Z",
      "updatedAt": "2025-10-01T00:00:00.000Z"
    },
    "creator": { "id": "usr_1", "email": "creator@aau.edu.et", "firstName": "M", "lastName": "Creator" },
    "address": {
      "country": "Ethiopia",
      "city": "Addis Ababa",
      "region": "Addis Ababa",
      "street": "King George VI St",
      "phone": "+251-11-123-4567",
      "website": "https://www.aau.edu.et"
    },
    "stats": {
      "includeInactive": true,
      "totalUsers": 1240,
      "roleName": "Student",
      "totalUsersWithRole": 840,
      "departments": [
        {
          "id": "dept_1",
          "name": "Computer Science",
          "code": "CS",
          "headOfDepartmentId": "usr_10",
          "head": { "id": "usr_10", "email": "hod@aau.edu.et", "firstName": "H", "lastName": "Dept" },
          "totalUsers": 300,
          "usersWithRole": 280
        }
      ]
    }
  },
  "timestamp": "2026-02-23T10:30:00.000Z"
}
```

Notes for frontend:
- `data.creator` may be `null` when the tenant was created by a platform admin.
- `data.address` may be `null` if not set.
- Use `stats.departments[]` to render department-level counts and head info.

Errors:
- `404 Not Found` — tenantId not found
- `401/403` — auth/role errors

---

### E) Update tenant address — `PATCH /admin/tenants/:tenantId/address`

Purpose: update/replace the tenant's contact address. Body should include only the fields to set; absent fields will not be changed unless your backend treats the payload as full replace (the backend currently merges fields).

Request body (recommended shape):

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

Example success response (200):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "tnt_123",
    "address": {
      "country": "Ethiopia",
      "city": "Addis Ababa",
      "region": "Addis Ababa",
      "street": "King George VI St",
      "phone": "+251-11-123-4567",
      "website": "https://www.aau.edu.et"
    }
  },
  "timestamp": "2026-02-23T10:30:00.000Z"
}
```

Errors:
- `400 Bad Request` — invalid body (e.g., malformed URL or invalid phone)
- `404 Not Found` — tenantId not found
- `401/403` — auth/role errors

---

### F) Update tenant status — `PATCH /admin/tenants/:tenantId/status`

Purpose: change the tenant lifecycle status.

Request body:

```json
{ "status": "SUSPENDED", "reason": "Non-payment" }
```

Notes:
- `reason` is optional but recommended for audit logs.
- Allowed statuses: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`.

Example success response (200):

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": "tnt_123", "status": "SUSPENDED" },
  "timestamp": "2026-02-23T10:30:00.000Z"
}
```

Errors:
- `400 Bad Request` — invalid/unsupported status
- `404 Not Found` — tenantId not found
- `401/403` — auth/role errors

---

### G) Delete tenant (soft delete / cancel) — `DELETE /admin/tenants/:tenantId`

Purpose: remove the tenant from active usage without physically deleting database rows.

Behavior:
- This is a **soft delete** implemented as setting `tenant.status = "CANCELLED"`.
- Use this for “Delete tenant” action in the admin dashboard.
- If you only want a temporary block, prefer `PATCH /admin/tenants/:tenantId/status` with `SUSPENDED`.

Example request:

`DELETE /admin/tenants/tnt_123`

Example success response (200):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "tnt_123",
    "name": "Addis University",
    "domain": "aau.edu.et",
    "status": "CANCELLED",
    "onboardingDate": "2025-09-01T00:00:00.000Z",
    "createdAt": "2025-09-01T00:00:00.000Z",
    "updatedAt": "2026-02-23T10:30:00.000Z"
  },
  "timestamp": "2026-02-23T10:30:00.000Z"
}
```

Errors:
- `400 Bad Request` — trying to delete the `system` tenant
- `404 Not Found` — tenantId not found
- `401/403` — auth/role errors


---

## 4) Minimal TypeScript types (frontend)

Create `src/lib/api-types.ts` in your frontend:

```ts
export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  timestamp: string;
};

export type ApiError = {
  success: false;
  message: string;
  error?: { code?: string; details?: any };
  timestamp?: string;
  path?: string;
};

export type ApiResponse<T> = ApiSuccess<T>;

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export type TenantAddress = {
  country?: string;
  city?: string;
  region?: string;
  street?: string;
  phone?: string;
  website?: string;
};

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type PersonSummary = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
  role?: string;
  createdAt?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  tenantId?: string | null;
};

export type AdminLoginSuccess = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

export type AdminLoginRequires2FA = {
  requiresTwoFactor: true;
  twoFactorToken: string;
};

export type AdminLoginResult = AdminLoginSuccess | AdminLoginRequires2FA;
```

---

## 5) Axios client (access token + refresh)

Create `src/lib/api.ts`:

```ts
import axios, { AxiosError } from 'axios';
import type { ApiError, ApiResponse } from './api-types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

export function getApiErrorMessage(err: unknown): string {
  const ax = err as AxiosError<ApiError>;
  return ax?.response?.data?.message || ax?.message || 'Network error';
}

export function unwrap<T>(res: ApiResponse<T>): T {
  return res.data;
}
```

You will attach the `Authorization: Bearer <token>` header via an interceptor using your Zustand auth store (next section).

---

## 6) Zustand: Admin Auth store (token persistence)

Create `src/stores/admin-auth.store.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminLoginResult, AdminLoginSuccess, AdminUser } from '../lib/api-types';
import { api, unwrap } from '../lib/api';

type AdminAuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  twoFactorToken: string | null;

  isAuthenticated: () => boolean;

  login: (params: { email: string; password: string }) => Promise<AdminLoginResult>;
  login2fa: (params: { code: string; method?: 'totp' | 'backup_code' }) => Promise<AdminLoginSuccess>;
  refresh: () => Promise<void>;
  logout: () => void;
};

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      twoFactorToken: null,

      isAuthenticated: () => !!get().accessToken,

      login: async ({ email, password }) => {
        const res = await api.post('/admin/auth/login', { email, password });
        const data = unwrap<AdminLoginResult>(res.data);

        if ((data as any).requiresTwoFactor) {
          set({ twoFactorToken: (data as any).twoFactorToken });
          return data;
        }

        const ok = data as AdminLoginSuccess;
        set({
          accessToken: ok.accessToken,
          refreshToken: ok.refreshToken,
          user: ok.user,
          twoFactorToken: null,
        });
        return ok;
      },

      login2fa: async ({ code, method }) => {
        const token = get().twoFactorToken;
        if (!token) throw new Error('Missing twoFactorToken. Call login() first.');

        const res = await api.post('/admin/auth/login/2fa', {
          twoFactorToken: token,
          code,
          method: method || 'totp',
        });
        const data = unwrap<AdminLoginSuccess>(res.data);

        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          twoFactorToken: null,
        });
        return data;
      },

      refresh: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) return;

        const res = await api.post('/admin/auth/refresh', { refreshToken });
        const data = unwrap<{ accessToken: string; refreshToken: string }>(res.data);
        set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      },

      logout: () => set({ accessToken: null, refreshToken: null, user: null, twoFactorToken: null }),
    }),
    { name: 'admin-auth' }
  )
);
```

### Add the Authorization header automatically

In `src/main.tsx` (or app bootstrap), install an interceptor once:

```ts
import { api } from './lib/api';
import { useAdminAuthStore } from './stores/admin-auth.store';

api.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

If you want automatic refresh on 401, add a response interceptor that calls `useAdminAuthStore.getState().refresh()` and retries once.

---

## 7) Zustand: Tenants list store (universities table)

Create `src/stores/admin-tenants.store.ts`:

```ts
import { create } from 'zustand';
import { api, unwrap } from '../lib/api';
import type { TenantStatus } from '../lib/api-types';

type TenantListItem = {
  id: string;
  name: string;
  domain: string;
  status: TenantStatus;
  onboardingDate: string;
  createdAt: string;
  updatedAt: string;
  config?: any;
};

type TenantListResponse = {
  items: TenantListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type AdminTenantsState = {
  items: TenantListItem[];
  meta: TenantListResponse['meta'] | null;
  loading: boolean;
  error: string | null;

  fetch: (params?: { page?: number; limit?: number; search?: string; status?: TenantStatus }) => Promise<void>;
};

export const useAdminTenantsStore = create<AdminTenantsState>((set) => ({
  items: [],
  meta: null,
  loading: false,
  error: null,

  fetch: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/admin/tenants', { params });
      const data = unwrap<TenantListResponse>(res.data);
      set({ items: data.items, meta: data.meta, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.message || e?.message || 'Failed to load tenants' });
    }
  },
}));
```

UI flow:

1. Admin logs in.
2. Tenants page calls `useAdminTenantsStore.getState().fetch({ page: 1, limit: 10 })`.

---

## 8) Zustand: Tenant details store (overview page)

Create `src/stores/admin-tenant-detail.store.ts`:

```ts
import { create } from 'zustand';
import { api, unwrap } from '../lib/api';
import type { TenantAddress, TenantStatus } from '../lib/api-types';

type OverviewDepartment = {
  id: string;
  name: string;
  code: string;
  headOfDepartmentId?: string | null;
  head?: PersonSummary | null;
  totalUsers: number;
  usersWithRole?: number;
};

type TenantOverview = {
  tenant: {
    id: string;
    name: string;
    domain: string;
    status: TenantStatus;
    onboardingDate: string;
    config?: any;
    createdAt: string;
    updatedAt: string;
  };
  creator: PersonSummary | null;
  address: TenantAddress | null;
  stats: {
    includeInactive: boolean;
    totalUsers: number;
    roleName?: string;
    totalUsersWithRole?: number;
    departments: OverviewDepartment[];
  };
};

type AdminTenantDetailState = {
  overview: TenantOverview | null;
  loading: boolean;
  error: string | null;

  fetchOverview: (tenantId: string, params?: { includeInactive?: boolean; roleName?: string }) => Promise<void>;
  updateAddress: (tenantId: string, address: TenantAddress) => Promise<void>;
  updateStatus: (tenantId: string, status: TenantStatus) => Promise<void>;
};

export const useAdminTenantDetailStore = create<AdminTenantDetailState>((set, get) => ({
  overview: null,
  loading: false,
  error: null,

  fetchOverview: async (tenantId, params) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/admin/tenants/${tenantId}/overview`, { params });
      const data = unwrap<TenantOverview>(res.data);
      set({ overview: data, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.message || e?.message || 'Failed to load tenant overview' });
    }
  },

  updateAddress: async (tenantId, address) => {
    await api.patch(`/admin/tenants/${tenantId}/address`, address);
    // Refresh details after update
    await get().fetchOverview(tenantId);
  },

  updateStatus: async (tenantId, status) => {
    await api.patch(`/admin/tenants/${tenantId}/status`, { status });
    await get().fetchOverview(tenantId);
  },
}));
```

Tenant overview page flow:

1. Page loads with `tenantId` (route param).
2. Call `fetchOverview(tenantId)`.
3. If you need role-filtered stats, call `fetchOverview(tenantId, { roleName: 'Student' })`.
4. For full counts, call `fetchOverview(tenantId, { includeInactive: true })`.

### Showing Department Head info on the detail page

You can render:

- Original creator: `overview.creator` (may be null)
- Current department head: `dept.head` (may be null)

Example (pseudo-UI):

```ts
const overview = useAdminTenantDetailStore((s) => s.overview);

const creatorName = overview?.creator
  ? `${overview.creator.firstName ?? ''} ${overview.creator.lastName ?? ''}`.trim()
  : 'N/A';

const creatorEmail = overview?.creator?.email ?? 'N/A';

// In departments table
const departments = overview?.stats.departments ?? [];
for (const d of departments) {
  const headLabel = d.head
    ? `${d.head.firstName ?? ''} ${d.head.lastName ?? ''}`.trim() || d.head.email || d.head.id
    : 'Not assigned';

  // render d.name, d.code, d.totalUsers, headLabel
}
```

---

## 9) Suggested page-by-page integration (stepwise)

### Step 1: Admin Login page

1. Call `useAdminAuthStore.getState().login({ email, password })`
2. If response has `requiresTwoFactor: true`:
   - show 2FA code input
   - call `login2fa({ code, method: 'totp' })`
3. After success, route to Tenants page

### Step 2: Tenants (Universities) list page

1. On mount: `useAdminTenantsStore.getState().fetch({ page: 1, limit: 10 })`
2. On row click: navigate to `/admin/tenants/:tenantId`

### Step 3: Tenant detail page (Option A)

1. On mount: `fetchOverview(tenantId)`
2. Address section:
   - edit form calls `updateAddress(tenantId, address)`
3. Status section:
   - dropdown calls `updateStatus(tenantId, 'SUSPENDED')`
4. Stats filters:
   - role filter calls `fetchOverview(tenantId, { roleName: 'Advisor' })`
   - include inactive toggle calls `fetchOverview(tenantId, { includeInactive: true })`

---

## 10) Common integration issues

1) `404 Not Found`

- You forgot `/api/v1` in the base URL.

2) `401 Unauthorized`

- Swagger worked but frontend fails: check you attached `Authorization: Bearer <token>`.

3) `403 Insufficient permissions`

- You are logging in with a non-PlatformAdmin account.

4) CORS issues

- Ensure your frontend origin is in the backend CORS allowlist.

---

## 11) Quick checklist

- Admin login succeeds and returns tokens
- Swagger Authorize token matches frontend token
- Tenants list loads with pagination
- Tenant overview loads and shows stats
- Address update persists and overview refreshes
- Status update persists and overview refreshes
