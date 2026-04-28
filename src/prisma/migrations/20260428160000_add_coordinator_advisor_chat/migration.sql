-- CreateTable
CREATE TABLE "coordinator_advisor_chat_rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "coordinator_user_id" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_advisor_chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_advisor_chat_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "text" VARCHAR(5000),
    "reply_to_message_id" TEXT,
    "attachment_url" TEXT,
    "attachment_public_id" TEXT,
    "attachment_resource_type" "ProjectGroupChatMessageAttachmentResourceType",
    "attachment_file_name" TEXT,
    "attachment_mime_type" TEXT,
    "attachment_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "coordinator_advisor_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_advisor_chat_message_reads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_advisor_chat_message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_advisor_chat_message_reactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_advisor_chat_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_advisor_chat_pinned_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "pinned_by_user_id" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_advisor_chat_pinned_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_advisor_chat_rooms_tenantId_coordinator_user_id__key" ON "coordinator_advisor_chat_rooms"("tenantId", "coordinator_user_id", "advisor_user_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_rooms_tenantId_department_id_creat_idx" ON "coordinator_advisor_chat_rooms"("tenantId", "department_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_rooms_coordinator_user_id_creat_idx" ON "coordinator_advisor_chat_rooms"("coordinator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_rooms_advisor_user_id_created__idx" ON "coordinator_advisor_chat_rooms"("advisor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_messages_tenantId_room_id_created_a_idx" ON "coordinator_advisor_chat_messages"("tenantId", "room_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_messages_room_id_created_at_idx" ON "coordinator_advisor_chat_messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_messages_sender_user_id_idx" ON "coordinator_advisor_chat_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_messages_reply_to_message_id_idx" ON "coordinator_advisor_chat_messages"("reply_to_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_advisor_chat_message_reads_message_id_user_id_key" ON "coordinator_advisor_chat_message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reads_tenantId_room_id_idx" ON "coordinator_advisor_chat_message_reads"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reads_room_id_user_id_re_idx" ON "coordinator_advisor_chat_message_reads"("room_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reads_user_id_read_at_idx" ON "coordinator_advisor_chat_message_reads"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_advisor_chat_message_reactions_message_id_user_i_key" ON "coordinator_advisor_chat_message_reactions"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reactions_tenantId_room_id_idx" ON "coordinator_advisor_chat_message_reactions"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reactions_room_id_message__idx" ON "coordinator_advisor_chat_message_reactions"("room_id", "message_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_message_reactions_user_id_idx" ON "coordinator_advisor_chat_message_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_advisor_chat_pinned_messages_room_id_message_i_key" ON "coordinator_advisor_chat_pinned_messages"("room_id", "message_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_pinned_messages_tenantId_room_id_idx" ON "coordinator_advisor_chat_pinned_messages"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_pinned_messages_room_id_pinned_a_idx" ON "coordinator_advisor_chat_pinned_messages"("room_id", "pinned_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_chat_pinned_messages_pinned_by_user_idx" ON "coordinator_advisor_chat_pinned_messages"("pinned_by_user_id");

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_rooms" ADD CONSTRAINT "coordinator_advisor_chat_rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_rooms" ADD CONSTRAINT "coordinator_advisor_chat_rooms_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_rooms" ADD CONSTRAINT "coordinator_advisor_chat_rooms_coordinator_user_id_fkey" FOREIGN KEY ("coordinator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_rooms" ADD CONSTRAINT "coordinator_advisor_chat_rooms_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_messages" ADD CONSTRAINT "coordinator_advisor_chat_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_messages" ADD CONSTRAINT "coordinator_advisor_chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "coordinator_advisor_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_messages" ADD CONSTRAINT "coordinator_advisor_chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_messages" ADD CONSTRAINT "coordinator_advisor_chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "coordinator_advisor_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reads" ADD CONSTRAINT "coordinator_advisor_chat_message_reads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reads" ADD CONSTRAINT "coordinator_advisor_chat_message_reads_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "coordinator_advisor_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reads" ADD CONSTRAINT "coordinator_advisor_chat_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "coordinator_advisor_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reads" ADD CONSTRAINT "coordinator_advisor_chat_message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reactions" ADD CONSTRAINT "coordinator_advisor_chat_message_reactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reactions" ADD CONSTRAINT "coordinator_advisor_chat_message_reactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "coordinator_advisor_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reactions" ADD CONSTRAINT "coordinator_advisor_chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "coordinator_advisor_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_message_reactions" ADD CONSTRAINT "coordinator_advisor_chat_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_pinned_messages" ADD CONSTRAINT "coordinator_advisor_chat_pinned_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_pinned_messages" ADD CONSTRAINT "coordinator_advisor_chat_pinned_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "coordinator_advisor_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_pinned_messages" ADD CONSTRAINT "coordinator_advisor_chat_pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "coordinator_advisor_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_chat_pinned_messages" ADD CONSTRAINT "coordinator_advisor_chat_pinned_messages_pinned_by_user_id_fkey" FOREIGN KEY ("pinned_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
