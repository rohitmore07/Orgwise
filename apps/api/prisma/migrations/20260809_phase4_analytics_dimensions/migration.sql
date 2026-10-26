-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "attrition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attritionDate" TIMESTAMP(3),
ADD COLUMN     "businessTravel" TEXT,
ADD COLUMN     "distanceFromHome" INTEGER,
ADD COLUMN     "education" INTEGER,
ADD COLUMN     "educationField" TEXT,
ADD COLUMN     "environmentSatisfaction" INTEGER,
ADD COLUMN     "jobLevel" INTEGER,
ADD COLUMN     "jobSatisfaction" INTEGER,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "monthlyIncome" INTEGER,
ADD COLUMN     "numCompaniesWorked" INTEGER,
ADD COLUMN     "overTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "percentSalaryHike" INTEGER,
ADD COLUMN     "performanceRating" INTEGER,
ADD COLUMN     "relationshipSatisfaction" INTEGER,
ADD COLUMN     "stockOptionLevel" INTEGER,
ADD COLUMN     "totalWorkingYears" INTEGER,
ADD COLUMN     "trainingTimesLastYear" INTEGER,
ADD COLUMN     "workLifeBalance" INTEGER,
ADD COLUMN     "yearsAtCompany" INTEGER,
ADD COLUMN     "yearsInCurrentRole" INTEGER,
ADD COLUMN     "yearsSinceLastPromotion" INTEGER,
ADD COLUMN     "yearsWithCurrManager" INTEGER;

-- AlterTable
ALTER TABLE "ImportHistory" ADD COLUMN     "durationMs" INTEGER;

-- CreateIndex
CREATE INDEX "Employee_attrition_idx" ON "Employee"("attrition");

-- CreateIndex
CREATE INDEX "Employee_overTime_idx" ON "Employee"("overTime");

-- CreateIndex
CREATE INDEX "Employee_jobSatisfaction_idx" ON "Employee"("jobSatisfaction");

-- CreateIndex
CREATE INDEX "Employee_monthlyIncome_idx" ON "Employee"("monthlyIncome");

-- CreateIndex
CREATE INDEX "Employee_jobTitle_idx" ON "Employee"("jobTitle");
