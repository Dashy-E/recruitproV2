-- Add document versioning and category tracking
ALTER TABLE "Document" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Document" ADD COLUMN "replacesDocumentId" TEXT;
ALTER TABLE "Document" ADD COLUMN "parseStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Document" ADD COLUMN "category" TEXT;

-- Index for fast candidate document lookups
CREATE INDEX IF NOT EXISTS "Document_candidateId_idx" ON "Document"("candidateId");
CREATE INDEX IF NOT EXISTS "Document_documentType_idx" ON "Document"("documentType");
CREATE INDEX IF NOT EXISTS "Document_approvalStatus_idx" ON "Document"("approvalStatus");

-- Index for MRF approval record lookups
CREATE INDEX IF NOT EXISTS "MRFApprovalRecord_mrfId_idx" ON "MRFApprovalRecord"("mrfId");

-- Index for candidate stage queries
CREATE INDEX IF NOT EXISTS "Candidate_currentStage_idx" ON "Candidate"("currentStage");
CREATE INDEX IF NOT EXISTS "Candidate_userId_idx" ON "Candidate"("userId");
