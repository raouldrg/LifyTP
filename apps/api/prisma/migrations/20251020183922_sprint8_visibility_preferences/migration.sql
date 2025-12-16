/*
  Warnings:

  - A unique constraint covering the columns `[shareCode]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'FRIENDS', 'LINK', 'PUBLIC');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "shareCode" TEXT,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "notificationOptIn" BOOLEAN NOT NULL DEFAULT true,
    "defaultEventVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_shareCode_key" ON "Event"("shareCode");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
