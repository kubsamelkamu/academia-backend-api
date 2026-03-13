-- CreateTable
CREATE TABLE "project_group_chat_message_reactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_chat_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_chat_pinned_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "pinned_by_user_id" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_chat_pinned_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_group_chat_message_reactions_message_id_user_id_key" ON "project_group_chat_message_reactions"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reactions_tenantId_room_id_idx" ON "project_group_chat_message_reactions"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reactions_room_id_message_id_idx" ON "project_group_chat_message_reactions"("room_id", "message_id");

-- CreateIndex
CREATE INDEX "project_group_chat_message_reactions_user_id_idx" ON "project_group_chat_message_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_chat_pinned_messages_room_id_message_id_key" ON "project_group_chat_pinned_messages"("room_id", "message_id");

-- CreateIndex
CREATE INDEX "project_group_chat_pinned_messages_tenantId_room_id_idx" ON "project_group_chat_pinned_messages"("tenantId", "room_id");

-- CreateIndex
CREATE INDEX "project_group_chat_pinned_messages_room_id_pinned_at_idx" ON "project_group_chat_pinned_messages"("room_id", "pinned_at");

-- CreateIndex
CREATE INDEX "project_group_chat_pinned_messages_pinned_by_user_id_idx" ON "project_group_chat_pinned_messages"("pinned_by_user_id");

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reactions" ADD CONSTRAINT "project_group_chat_message_reactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reactions" ADD CONSTRAINT "project_group_chat_message_reactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "project_group_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reactions" ADD CONSTRAINT "project_group_chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "project_group_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_message_reactions" ADD CONSTRAINT "project_group_chat_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_pinned_messages" ADD CONSTRAINT "project_group_chat_pinned_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_pinned_messages" ADD CONSTRAINT "project_group_chat_pinned_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "project_group_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_pinned_messages" ADD CONSTRAINT "project_group_chat_pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "project_group_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_chat_pinned_messages" ADD CONSTRAINT "project_group_chat_pinned_messages_pinned_by_user_id_fkey" FOREIGN KEY ("pinned_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
