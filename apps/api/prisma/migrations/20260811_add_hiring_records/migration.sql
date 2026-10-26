-- CreateTable
CREATE TABLE "HiringRecord" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "candidateName" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "firstInterviewAt" TIMESTAMP(3),
    "offerSentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "offerStatus" TEXT,
    "status" TEXT NOT NULL,
    "sourcingCost" INTEGER,
    "recruitingCost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringRecord_departmentId_idx" ON "HiringRecord"("departmentId");

-- CreateIndex
CREATE INDEX "HiringRecord_status_idx" ON "HiringRecord"("status");

-- CreateIndex
CREATE INDEX "HiringRecord_openedAt_idx" ON "HiringRecord"("openedAt");

-- AddForeignKey
ALTER TABLE "HiringRecord" ADD CONSTRAINT "HiringRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
