# Frontend Advisor Project Group Meeting Integration Playbook

This playbook is a practical one-by-one implementation plan to integrate the meeting scheduler feature safely.

## 0) What is already done in backend

Implemented and available now:
1. Advisor meeting scheduling for supervised and approved project groups.
2. Advisor meeting history list and meeting detail.
3. Advisor update/reschedule.
4. Advisor cancel while preserving history.
5. Student meeting list and meeting detail.
6. In-app notifications for scheduled, updated, cancelled, 24h reminder, 1h reminder.
7. Realtime socket event: project-group-meeting with type scheduled/updated/cancelled.
8. Scheduler reminders every minute with idempotent markers:
   - reminder24hSentAt
   - reminder1hSentAt
9. Optional reminder emails (24h and 1h) if template IDs are configured.
10. Advisor list filters:
   - ALL
   - UPCOMING_REMINDERS (window: 24h or 1h)
   - CANCELLED
11. Scheduler unit tests for idempotency and timing windows.

## 1) Integration order (strict)

Follow this order to reduce debugging:
1. Advisor project selector and meeting list read flow.
2. Schedule meeting create flow.
3. Meeting detail view.
4. Update/reschedule flow.
5. Cancel flow.
6. Realtime updates.
7. Notification panel mapping.
8. Advisor filters for reminders and cancelled.
9. Optional email reminders rollout verification.

## 2) Step 1 - Build advisor read flow first

Goal:
- Render meetings for selected project before adding write actions.

APIs:
1. GET /api/v1/projects/advisors/me/projects
2. GET /api/v1/project-groups/advisors/me/meetings?projectId=<projectId>&page=1&limit=20

Frontend output:
1. Project dropdown for advisor projects.
2. Meeting list with:
   - title
   - meetingAt
   - durationMinutes
   - agenda preview
   - isUpcoming/isOngoing/isCompleted
   - isCancelled

Validation:
1. Changing selected project refetches meetings.
2. Pagination works.
3. Empty state is shown clearly.

## 3) Step 2 - Add schedule meeting form

API:
- POST /api/v1/project-groups/advisors/me/meetings

Body:
- projectId
- title
- meetingAt (ISO)
- durationMinutes (>= 15)
- agenda

UI behavior:
1. On success, prepend new meeting card/row.
2. Show success toast.
3. Keep current project selected.

Validation:
1. meetingAt must be future.
2. title and agenda required.
3. durationMinutes minimum 15.

## 4) Step 3 - Meeting details page/modal

API:
- GET /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<projectId>

UI behavior:
1. Open details from list row click.
2. Show cancellation fields if cancelled:
   - isCancelled
   - cancelledAt
   - cancellationReason

Validation:
1. Meeting details match list item.
2. Cancelled meeting shows disabled update actions.

## 5) Step 4 - Update and cancel actions

APIs:
1. PATCH /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<projectId>
2. DELETE /api/v1/project-groups/advisors/me/meetings/:meetingId?projectId=<projectId>

Update body (partial):
- title?
- meetingAt?
- durationMinutes?
- agenda?

Cancel body:
- reason? (optional)

UI behavior:
1. Update action refreshes row/detail.
2. Cancel action keeps item in history but with cancelled state.

Validation:
1. Cancelled meeting can no longer be updated.
2. Reschedule updates meetingAt and derived state flags.

## 6) Step 5 - Realtime event integration

Socket namespace:
- /notifications

Event name:
- project-group-meeting

Payload type:
- scheduled
- updated
- cancelled

UI behavior:
1. scheduled -> insert or refetch list.
2. updated -> patch existing item by meetingId.
3. cancelled -> mark item cancelled by meetingId.

Validation:
1. Open two advisor tabs and verify realtime update sync.

## 7) Step 6 - Notification mapping

Map event types in frontend notification center:
1. PROJECT_GROUP_MEETING_SCHEDULED
2. PROJECT_GROUP_MEETING_UPDATED
3. PROJECT_GROUP_MEETING_CANCELLED
4. PROJECT_GROUP_MEETING_REMINDER_24H
5. PROJECT_GROUP_MEETING_REMINDER_1H

UI behavior:
1. Reminder click navigates to meeting detail.
2. Show event-specific labels and urgency style.

## 8) Step 7 - Advisor filter integration

Advisor list endpoint now supports:
- filter=ALL
- filter=UPCOMING_REMINDERS&reminderWindowHours=24
- filter=UPCOMING_REMINDERS&reminderWindowHours=1
- filter=CANCELLED

Recommended UI:
1. Tabs: All, Upcoming 24h, Upcoming 1h, Cancelled.
2. Keep current page reset to 1 on filter change.

Validation:
1. 24h and 1h lists show only upcoming non-cancelled items in those windows.
2. Cancelled tab shows only cancelled records.

## 9) Step 8 - Optional email reminders rollout

This is optional and independent from in-app reminders.

Required env keys:
1. BREVO_PROJECT_GROUP_MEETING_REMINDER_24H_TEMPLATE_ID
2. BREVO_PROJECT_GROUP_MEETING_REMINDER_1H_TEMPLATE_ID

Prepared template files:
1. docs/email-templates/project-group-meeting-reminder-24h.html
2. docs/email-templates/project-group-meeting-reminder-1h.html

Template variable source:
- Scheduler sends params including:
  - appName
  - logoUrl
  - supportEmail
  - currentYear
  - meetingId
  - meetingTitle
  - meetingAt
  - durationMinutes
  - agenda
  - projectId
  - projectGroupId
  - remaining
  - reminderType

Validation:
1. If template IDs are missing, in-app reminders still work.
2. If template IDs are set, both in-app and email reminders are sent.

## 10) Student side integration checkpoints

Student APIs:
1. GET /api/v1/project-groups/me/meetings?page=1&limit=20
2. GET /api/v1/project-groups/me/meetings/:meetingId

Student UI:
1. Meeting history list.
2. Detail view.
3. Cancelled badge and cancellation reason visibility.

## 11) Suggested frontend types

Use equivalent shapes in your frontend model:
1. AdvisorMeetingFilter = ALL | UPCOMING_REMINDERS | CANCELLED
2. ReminderWindowHours = 24 | 1
3. RealtimeMeetingEventType = scheduled | updated | cancelled

## 12) Definition of done checklist

Mark done only when all checks pass:
1. Advisor can create, list, detail, update, cancel meetings.
2. Student can list and detail meetings.
3. Realtime event updates UI without manual refresh.
4. Notification event types are rendered correctly.
5. Advisor filters return expected items.
6. Reminder emails are verified in staging when template IDs are configured.
7. In-app reminder behavior still works when email templates are not configured.
