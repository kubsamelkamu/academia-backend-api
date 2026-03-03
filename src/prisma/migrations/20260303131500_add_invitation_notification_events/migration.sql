-- Add new notification event types for invitation flows
ALTER TYPE "NotificationEventType" ADD VALUE 'INVITATION_SENT';
ALTER TYPE "NotificationEventType" ADD VALUE 'INVITATIONS_BULK_SENT';
