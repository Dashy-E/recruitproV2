-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
