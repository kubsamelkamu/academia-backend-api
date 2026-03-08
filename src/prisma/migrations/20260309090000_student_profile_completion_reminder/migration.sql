-- Add one-time student profile completion reminder marker

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "student_profile_reminder_sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_student_profile_reminder_sent_at_idx"
ON "users"("student_profile_reminder_sent_at");
