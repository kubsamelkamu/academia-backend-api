-- CreateEnum
CREATE TYPE "ProjectGroupChatMessageAttachmentResourceType" AS ENUM ('image', 'raw');

-- CreateTable
CREATE TABLE "project_group_chat_rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_chat_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "text" VARCHAR(5000),
    "attachment_url" TEXT,
    "attachment_public_id" TEXT,
    "attachment_resource_type" "ProjectGroupChatMessageAttachmentResourceType",
    "attachment_file_name" TEXT,
    "attachment_mime_type" TEXT,
    "attachment_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_chat_message_reads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_chat_message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_group_chat_rooms_project_group_id_key" ON "project_group_chat_rooms"("project_group_id");

-- CreateIndex
CREATE INDEX "project_group_chat_rooms_tenantId_idx" ON "project_group_chat_rooms"("tenantId");

-- CreateIndex
CREATE INDEX "project_group_chat_rooms_project_group_id_idx" ON "project_group_chat_rooms"("project_group_id");

-- CreateIndex
CREATE INDEX "project_group_chat_messages_tenantId_room_id_created_at_idx" ON "project_group_chat_messages"("tenantId", "room_id", "created_at");

-- CreateIndex
CREATE INDEX "project_group_chat_messages_room_id_created_at_idx" ON "project_group_chat_messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "project_group_chat_messages_sender_user_id_idx" ON "project_group_chat_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reads_tenantId_room_id_idx" ON "project_group_chat_message_reads"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reads_room_id_user_id_read_at_idx" ON "project_group_chat_message_reads"("room_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reads_user_id_read_at_idx" ON "project_group_chat_message_reads"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_chat_message_reads_message_id_user_id_key" ON "project_group_chat_message_reads"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "project_group_chat_rooms" ADD CONSTRAINT "project_group_chat_rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_rooms" ADD CONSTRAINT "project_group_chat_rooms_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_messages" ADD CONSTRAINT "project_group_chat_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_messages" ADD CONSTRAINT "project_group_chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "project_group_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_messages" ADD CONSTRAINT "project_group_chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reads" ADD CONSTRAINT "project_group_chat_message_reads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reads" ADD CONSTRAINT "project_group_chat_message_reads_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "project_group_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reads" ADD CONSTRAINT "project_group_chat_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "project_group_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reads" ADD CONSTRAINT "project_group_chat_message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
