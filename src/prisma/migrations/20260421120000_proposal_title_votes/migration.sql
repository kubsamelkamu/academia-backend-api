-- CreateTable
CREATE TABLE "proposal_title_votes" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "voter_role" VARCHAR(50) NOT NULL,
    "title_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_title_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_title_votes_proposal_id_voter_id_key" ON "proposal_title_votes"("proposal_id", "voter_id");

-- CreateIndex
CREATE INDEX "proposal_title_votes_proposal_id_created_at_idx" ON "proposal_title_votes"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_title_votes_voter_id_idx" ON "proposal_title_votes"("voter_id");

-- AddForeignKey
ALTER TABLE "proposal_title_votes" ADD CONSTRAINT "proposal_title_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_title_votes" ADD CONSTRAINT "proposal_title_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
