-- CreateTable
CREATE TABLE "project_group_members" (
    "id" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_group_members_project_group_id_idx" ON "project_group_members"("project_group_id");

-- CreateIndex
CREATE INDEX "project_group_members_user_id_idx" ON "project_group_members"("user_id");

-- CreateIndex
CREATE INDEX "project_group_members_joined_at_idx" ON "project_group_members"("joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_members_project_group_id_user_id_key" ON "project_group_members"("project_group_id", "user_id");

-- AddForeignKey
ALTER TABLE "project_group_members" ADD CONSTRAINT "project_group_members_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_members" ADD CONSTRAINT "project_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
