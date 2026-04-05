-- CreateTable
CREATE TABLE "milestone_submission_feedbacks" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "submission_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_role" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "attachment_file_name" VARCHAR(255),
    "attachment_mime_type" VARCHAR(255),
    "attachment_size_bytes" INTEGER,
    "attachment_url" TEXT,
    "attachment_public_id" TEXT,
    "attachment_resource_type" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_submission_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_submission_feedbacks_submission_id_created_at_idx" ON "milestone_submission_feedbacks"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "milestone_submission_feedbacks_author_id_idx" ON "milestone_submission_feedbacks"("author_id");

-- AddForeignKey
ALTER TABLE "milestone_submission_feedbacks" ADD CONSTRAINT "milestone_submission_feedbacks_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "milestone_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_submission_feedbacks" ADD CONSTRAINT "milestone_submission_feedbacks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;