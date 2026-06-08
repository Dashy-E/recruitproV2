-- CreateTable
CREATE TABLE "Employee" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT,
    "mrfId" TEXT,
    CONSTRAINT "Email_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Email_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mrfId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'APPLIED',
    "aiScore" REAL,
    "aiScoreNotes" TEXT,
    "resumeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "candidateStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "interviewDate" DATETIME,
    CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Candidate_mrfId_fkey" FOREIGN KEY ("mrfId") REFERENCES "MRF" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Candidate" ("aiScore", "aiScoreNotes", "createdAt", "currentStage", "email", "firstName", "id", "isActive", "lastName", "mrfId", "phone", "resumeUrl", "updatedAt", "userId") SELECT "aiScore", "aiScoreNotes", "createdAt", "currentStage", "email", "firstName", "id", "isActive", "lastName", "mrfId", "phone", "resumeUrl", "updatedAt", "userId" FROM "Candidate";
DROP TABLE "Candidate";
ALTER TABLE "new_Candidate" RENAME TO "Candidate";
CREATE UNIQUE INDEX "Candidate_userId_key" ON "Candidate"("userId");
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");
CREATE TABLE "new_MRF" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrfNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "divisionId" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT,
    "vacancyCount" INTEGER NOT NULL DEFAULT 1,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "vacancyType" TEXT,
    "replacedEmployeeName" TEXT,
    "replacedEmployeeCTC" TEXT,
    "replacementFor" TEXT,
    "replacementReason" TEXT,
    "replacementNecessityReason" TEXT,
    "isNewRole" BOOLEAN NOT NULL DEFAULT false,
    "isBusinessExpansion" BOOLEAN NOT NULL DEFAULT false,
    "newRoleJustification" TEXT,
    "isBudgeted" BOOLEAN,
    "proposedGrade" TEXT,
    "ctcRange" TEXT,
    "location" TEXT,
    "reportingTo" TEXT,
    "jobProfile" TEXT,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "minQualification" TEXT,
    "preferredQualification" TEXT,
    "workExperience" TEXT,
    "industryBackground" TEXT,
    "otherSpecs" TEXT,
    "contributionJustified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MRF_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MRF_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MRF_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MRF_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MRF_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MRF_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MRF" ("approvedAt", "branchId", "countryId", "createdAt", "createdById", "departmentId", "designationId", "divisionId", "id", "justification", "mrfNumber", "rejectedAt", "rejectionReason", "status", "title", "updatedAt", "vacancyCount") SELECT "approvedAt", "branchId", "countryId", "createdAt", "createdById", "departmentId", "designationId", "divisionId", "id", "justification", "mrfNumber", "rejectedAt", "rejectionReason", "status", "title", "updatedAt", "vacancyCount" FROM "MRF";
DROP TABLE "MRF";
ALTER TABLE "new_MRF" RENAME TO "MRF";
CREATE UNIQUE INDEX "MRF_mrfNumber_key" ON "MRF"("mrfNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_candidateId_key" ON "Employee"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
