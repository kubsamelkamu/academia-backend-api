# Frontend Public Platform Stats Integration Guide

This guide explains how to consume the **public** (no-auth) endpoint used by marketing/public pages to display platform-wide counts.

## Endpoint

- Method: `GET`
- URL: `/api/v1/public/platform-stats`
- Auth: **None** (public)

## What is counted

By default, the endpoint returns counts across tenants with status `ACTIVE` or `TRIAL`:

- `totalStudents`: number of `Student` profiles whose linked `User` is `ACTIVE` and not soft-deleted
- `totalAdvisors`: number of `Advisor` records whose linked `User` is `ACTIVE` and not soft-deleted
- `totalActiveProjects`: number of `Project` records with `status = ACTIVE`
- `totalCompletedProjects`: number of `Project` records with `status = COMPLETED`

## Response shape

The API uses the standard response wrapper (global transform interceptor):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "totalStudents": 1280,
    "totalAdvisors": 85,
    "totalActiveProjects": 320,
    "totalCompletedProjects": 140
  },
  "timestamp": "2026-04-21T10:30:00.000Z"
}
```

## Frontend example

```ts
type PlatformStats = {
  totalStudents: number;
  totalAdvisors: number;
  totalActiveProjects: number;
  totalCompletedProjects: number;
};

async function fetchPlatformStats(apiBaseUrl: string): Promise<PlatformStats> {
  const res = await fetch(`${apiBaseUrl}/api/v1/public/platform-stats`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);

  const json = (await res.json()) as {
    success: boolean;
    message: string;
    data: PlatformStats;
    timestamp: string;
  };

  return json.data;
}
```
