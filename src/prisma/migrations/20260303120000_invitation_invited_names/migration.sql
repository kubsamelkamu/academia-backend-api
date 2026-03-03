-- Add invited user names (captured at invitation time)

ALTER TABLE "invitations"
ADD COLUMN "invitee_first_name" VARCHAR(100),
ADD COLUMN "invitee_last_name" VARCHAR(100);
