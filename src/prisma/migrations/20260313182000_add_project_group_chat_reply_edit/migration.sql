-- AlterTable
ALTER TABLE "project_group_chat_messages" ADD COLUMN "reply_to_message_id" TEXT;
ALTER TABLE "project_group_chat_messages" ADD COLUMN "edited_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "project_group_chat_messages_reply_to_message_id_idx" ON "project_group_chat_messages"("reply_to_message_id");

-- AddForeignKey
ALTER TABLE "project_group_chat_messages" ADD CONSTRAINT "project_group_chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "project_group_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
