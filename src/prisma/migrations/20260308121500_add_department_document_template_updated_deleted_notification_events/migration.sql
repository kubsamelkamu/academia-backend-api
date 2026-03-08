-- Add department document template notification event types
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_DOCUMENT_TEMPLATE_UPDATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_DOCUMENT_TEMPLATE_DELETED';
