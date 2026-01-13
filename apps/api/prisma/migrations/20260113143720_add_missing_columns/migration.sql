/*
  Warnings:

  - You are about to drop the column `deletedForUserIds` on the `Conversation` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('NORMAL', 'REQUEST', 'REJECTED');

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "deletedForUserIds",
ADD COLUMN     "initiatedByUserId" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastMessagePreview" TEXT,
ADD COLUMN     "requestAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "requestCreatedAt" TIMESTAMP(3),
ADD COLUMN     "requestReceiverId" TEXT,
ADD COLUMN     "requestRejectedAt" TIMESTAMP(3),
ADD COLUMN     "requestSenderId" TEXT,
ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "recurrenceEndAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceGroupId" TEXT,
ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_requestReceiverId_idx" ON "Conversation"("requestReceiverId");

-- CreateIndex
CREATE INDEX "Event_recurrenceGroupId_idx" ON "Event"("recurrenceGroupId");

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
