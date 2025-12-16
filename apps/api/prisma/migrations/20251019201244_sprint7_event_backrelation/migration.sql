-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'ICS');

-- CreateEnum
CREATE TYPE "CalendarStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "LinkedCalendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "url" TEXT,
    "timezone" TEXT,
    "status" "CalendarStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedEvent" (
    "id" TEXT NOT NULL,
    "linkedCalendarId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "locationName" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "sourceUID" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lifyEventId" TEXT,

    CONSTRAINT "LinkedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedCalendar_userId_idx" ON "LinkedCalendar"("userId");

-- CreateIndex
CREATE INDEX "LinkedEvent_start_endAt_idx" ON "LinkedEvent"("start", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedEvent_linkedCalendarId_externalId_key" ON "LinkedEvent"("linkedCalendarId", "externalId");

-- AddForeignKey
ALTER TABLE "LinkedEvent" ADD CONSTRAINT "LinkedEvent_lifyEventId_fkey" FOREIGN KEY ("lifyEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedEvent" ADD CONSTRAINT "LinkedEvent_linkedCalendarId_fkey" FOREIGN KEY ("linkedCalendarId") REFERENCES "LinkedCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
