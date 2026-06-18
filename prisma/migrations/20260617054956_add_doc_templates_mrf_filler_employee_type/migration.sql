-- AlterTable
ALTER TABLE "Document" ADD COLUMN "extractedData" TEXT;

-- AlterTable
ALTER TABLE "MRF" ADD COLUMN "fillerDesignation" TEXT;
ALTER TABLE "MRF" ADD COLUMN "fillerName" TEXT;

-- AlterTable
ALTER TABLE "MRFApprovalRecord" ADD COLUMN "approverDesignation" TEXT;

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentTemplate_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "joiningDate" DATETIME NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "ctc" REAL,
    "reportingTo" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "employeeType" TEXT NOT NULL DEFAULT 'INDIA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("branchId", "candidateId", "createdAt", "ctc", "department", "designation", "employeeCode", "id", "isActive", "joiningDate", "onboardingStep", "reportingTo", "updatedAt") SELECT "branchId", "candidateId", "createdAt", "ctc", "department", "designation", "employeeCode", "id", "isActive", "joiningDate", "onboardingStep", "reportingTo", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_candidateId_key" ON "Employee"("candidateId");
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
