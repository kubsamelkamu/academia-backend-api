-- CreateTable
CREATE TABLE "proposal_feedbacks" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_role" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_feedbacks_proposal_id_created_at_idx" ON "proposal_feedbacks"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_feedbacks_author_id_idx" ON "proposal_feedbacks"("author_id");

-- AddForeignKey
ALTER TABLE "proposal_feedbacks" ADD CONSTRAINT "proposal_feedbacks_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_feedbacks" ADD CONSTRAINT "proposal_feedbacks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
