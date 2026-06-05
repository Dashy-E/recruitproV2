-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'OTHER',
    "uploadedById" TEXT NOT NULL,
    "candidateId" TEXT,
    "mrfId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_mrfId_fkey" FOREIGN KEY ("mrfId") REFERENCES "MRF" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("candidateId", "createdAt", "documentType", "fileSize", "fileType", "fileUrl", "id", "mrfId", "name", "uploadedById") SELECT "candidateId", "createdAt", "documentType", "fileSize", "fileType", "fileUrl", "id", "mrfId", "name", "uploadedById" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
