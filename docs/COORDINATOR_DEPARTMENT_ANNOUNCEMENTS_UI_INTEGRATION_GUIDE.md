# Coordinator Department Announcements Management UI — Integration Steps

This guide provides clear, step-by-step instructions for integrating the Department Announcements Management UI for the **Coordinator** role. Share this with your teammates for a smooth implementation.

---

## 1. Overview

- Coordinators can **create**, **edit**, **delete**, and **view** department announcements.
- Announcements may include a title, message, optional call-to-action (CTA), and optional deadline.
- All API endpoints require the `COORDINATOR` role.

---

## 2. API Endpoints

**Base path:**
`/api/v1/departments/:departmentId/announcements`

- **List:** `GET /api/v1/departments/:departmentId/announcements?page=1&limit=20`
- **Create:** `POST /api/v1/departments/:departmentId/announcements`
- **Get One:** `GET /api/v1/departments/:departmentId/announcements/:announcementId`
- **Update:** `PATCH /api/v1/departments/:departmentId/announcements/:announcementId`
- **Delete:** `DELETE /api/v1/departments/:departmentId/announcements/:announcementId`

---

## 3. UI Screens & Flows

### A. Announcements List Page

- Fetch and display announcements using the List API.
- Show:
  - Title, message preview
  - Created by (firstName + lastName), created date
  - Deadline badge (if `deadlineAt` exists, show countdown using `secondsRemaining`)
  - Status “Expired” if `isExpired` is true
  - CTA preview (`actionLabel` + `actionUrl`)
- Provide buttons for:
  - “Create announcement”
  - “Edit” and “Delete” for each announcement

### B. Create Announcement Form

- Fields:
  - `title` (required, max 255)
  - `message` (required, max 5000)
  - `actionType` (required: enum)
  - `actionLabel` (optional, max 120)
  - `actionUrl` (optional, must be valid URL with protocol)
  - `deadlineAt` (optional, must be future date/time)
- Use a datetime picker for `deadlineAt`, convert to ISO string before sending.
- On submit:
  - Validate required fields and deadline (must be in the future).
  - POST to Create API.
  - On success: show toast “Announcement created”, add to top of list.

### C. Edit Announcement Form

- Prefill form with existing data (from list or fetch fresh).
- Allow editing any field.
- If deadline is removed, send `{ "clearDeadline": true }` in PATCH.
- If deadline is changed, send new `deadlineAt` (ISO string).
- If deadline is untouched, omit both `deadlineAt` and `clearDeadline`.
- On success: show toast “Announcement updated”, update list.

### D. Delete Confirmation

- Show confirmation dialog: “Delete this announcement?”
- On confirm: call Delete API.
- On success: remove from list, show toast “Announcement deleted”.

---

## 4. Validation & Error Handling

- Validate all required fields client-side.
- Deadline must be in the future (disable submit if not).
- If `actionUrl` is provided, ensure it’s a valid URL with protocol.
- If `actionLabel` is empty, omit it from the request.
- Map backend errors to user-friendly messages:
  - `403`: “You do not have access to this department.”
  - `400` (deadline): “Deadline must be in the future.”
  - `400` (URL): “Action URL must be a valid URL.”
  - `404`: “Announcement no longer exists.” (refetch list)

---

## 5. Realtime Updates

- Backend emits `department-announcement` events via Socket.IO (`/notifications` namespace).
- If you want live updates, refetch the list after any event.

---

## 6. Acceptance Checklist

- [ ] Can view department announcements list
- [ ] Can create announcement (with validation)
- [ ] Can set optional deadline (must be future)
- [ ] Can edit announcement and update/clear deadline
- [ ] Can delete announcement and remove from UI
- [ ] Errors are displayed clearly to the user

---

**Tip:**
Keep the UI simple and user-friendly. Always handle backend errors gracefully, and ensure all fields are validated before submission.
