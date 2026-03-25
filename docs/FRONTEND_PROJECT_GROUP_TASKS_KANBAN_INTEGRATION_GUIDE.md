# Frontend Project Group Tasks (Kanban) Integration Guide

This guide describes the **Project Group Tasks** feature for students inside an **APPROVED** project group.

## Overview

- Kanban statuses: `TODO` → `IN_PROGRESS` → `DONE`
- Scope: tasks belong to the authenticated student's **own approved project group** (`project-groups/me/...`).
- Create: **any group member** can create tasks.
- Edit details: **task creator OR group leader**.
- Change status: **task assignee OR group leader**.
- Reassign/unassign: **group leader only**.
- Delete: **task creator OR group leader** (hard delete).

## Authentication

All endpoints require a Bearer access token.

- Role required: `STUDENT`

## API Endpoints

Base path (versioned): `/api/v1/project-groups/me/tasks`

### 1) Create task

`POST /api/v1/project-groups/me/tasks`

Body:
```json
{
  "title": "Implement login UI",
  "description": "Create the login screen and connect to API.",
  "dueDate": "2026-04-05T00:00:00.000Z",
  "assignedToUserId": "<user-uuid>"
}
```

Notes:
- If `assignedToUserId` is provided:
  - Group leader can assign to any group member.
  - Non-leader members can only assign to themselves.

Response:
```json
{
  "task": {
    "id": "...",
    "projectGroupId": "...",
    "createdByUserId": "...",
    "assignedToUserId": "...",
    "title": "...",
    "description": "...",
    "dueDate": "...",
    "status": "TODO",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 2) List tasks (board)

`GET /api/v1/project-groups/me/tasks`

Response:
```json
{
  "items": [
    {
      "id": "...",
      "title": "...",
      "status": "IN_PROGRESS",
      "assignedToUserId": "...",
      "createdByUserId": "...",
      "dueDate": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Frontend: group `items` by `status` into 3 columns.

### 3) Get task details

`GET /api/v1/project-groups/me/tasks/:taskId`

Response:
```json
{ "task": { "id": "...", "title": "...", "status": "TODO" } }
```

### 4) Update task details (title/description/dueDate)

`PATCH /api/v1/project-groups/me/tasks/:taskId`

Body (any subset):
```json
{
  "title": "Update login UI",
  "description": "...",
  "dueDate": "2026-04-08T00:00:00.000Z"
}
```

Permission:
- task creator OR group leader

### 5) Update task status

`PATCH /api/v1/project-groups/me/tasks/:taskId/status`

Body:
```json
{ "status": "DONE" }
```

Permission:
- task assignee OR group leader

### 6) Reassign / unassign task

`PATCH /api/v1/project-groups/me/tasks/:taskId/assignee`

Assign:
```json
{ "assignedToUserId": "<user-uuid>" }
```

Unassign (send empty body):
```json
{}
```

Permission:
- group leader only

### 7) Delete task

`DELETE /api/v1/project-groups/me/tasks/:taskId`

Response:
```json
{ "deleted": true }
```

Permission:
- task creator OR group leader

## Common error cases

- Group not approved yet: returns `400` with message like `Group is not approved yet`.
- Assignee not in group: returns `400`.
- Permission denied: returns `403`.

## Notifications (due-date reminders)

If a task has a `dueDate` and an `assignedToUserId`, the backend periodically sends an in-app notification when the task is due within the next ~24 hours:

- The assignee receives the reminder.
- The group leader also receives the reminder (only when leader ≠ assignee).

- WebSocket namespace: `/notifications`
- Event name: `notification`
- `eventType`: `PROJECT_GROUP_TASK_DUE_DATE_24H`
- `metadata` includes: `taskId`, `projectGroupId`, `assignedToUserId`, `dueDate`, `reminderType`, `recipientRole`
