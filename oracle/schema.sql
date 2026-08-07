-- ============================================================================
-- RecruitPro ERP — Oracle SQL schema
-- Converted from prisma/schema.prisma (SQLite, via @prisma/adapter-libsql).
-- All tables are prefixed RECRUIT_T_<Name> per naming convention.
--
-- ASSUMPTIONS / NOTES
-- 1. Targets Oracle 12.2+ (128-byte identifier limit). Some generated
--    constraint names below exceed the old 30-byte limit; shorten them
--    if you must support 11g/12.1.
-- 2. Booleans are stored as NUMBER(1) with a CHECK (col IN (0,1)) since
--    native BOOLEAN columns only exist from Oracle 23ai onward. If you're
--    on 23ai, you can replace NUMBER(1) with BOOLEAN and drop the CHECKs.
-- 3. All "id" / "*Id" columns are VARCHAR2(30) — Prisma's cuid() default
--    is generated in the application layer, not the database, so there
--    is no DB-side DEFAULT for id columns here (matches the original
--    SQLite migrations, which also have none).
-- 4. "updatedAt" columns have no DB default/trigger — Prisma's
--    @updatedAt is maintained by the query engine on every write, not
--    by the database. Add a BEFORE UPDATE trigger per table if this
--    schema will ever be written to outside of Prisma.
-- 5. Email.mrfId is intentionally FK-less, matching the original Prisma
--    schema, which declares no @relation for it.
-- 6. Prisma has no official Oracle connector — this script is meant to
--    provision a standalone Oracle instance, not to be pointed at by
--    Prisma Client directly.
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Generic self-referencing org tree (Corporate / India / PSPL / Gemini /
-- Overseas and everything under them), replacing the old fixed-depth
-- Country -> Division -> State -> Branch chain. Depth is arbitrary — some
-- branches are 2 levels deep (Overseas > China), others 4 (Overseas > West
-- Africa > Morocco). Admin manages this tree at runtime; no code change is
-- needed to add/move/rename a node.
CREATE TABLE "RECRUIT_T_OrgUnit" (
    "id"        VARCHAR2(30)  NOT NULL,
    "name"      VARCHAR2(255) NOT NULL,
    "parentId"  VARCHAR2(30),
    "sortOrder" NUMBER(10)    DEFAULT 0 NOT NULL,
    "isActive"  NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt" TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP     NOT NULL,
    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrgUnit_isActive_chk" CHECK ("isActive" IN (0,1))
);

-- Multi-assignment: a user can be tied to one or many nodes anywhere in the
-- tree; access to a node implies access to everything beneath it (resolved
-- in application code — see src/lib/org-access.ts — rather than via Oracle
-- recursive CTEs/CONNECT BY, since the tree is small and this avoids the
-- Knex+oracledb type-inference issues already hit elsewhere in this schema).
CREATE TABLE "RECRUIT_T_UserOrgUnit" (
    "id"        VARCHAR2(30) NOT NULL,
    "userId"    VARCHAR2(30) NOT NULL,
    "orgUnitId" VARCHAR2(30) NOT NULL,
    "createdAt" TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT "UserOrgUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_Department" (
    "id"        VARCHAR2(30)  NOT NULL,
    "name"      VARCHAR2(255) NOT NULL,
    "isActive"  NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt" TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP     NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Department_isActive_chk" CHECK ("isActive" IN (0,1))
);

CREATE TABLE "RECRUIT_T_DepartmentFunctionalHead" (
    "id"           VARCHAR2(30) NOT NULL,
    "departmentId" VARCHAR2(30) NOT NULL,
    "userId"       VARCHAR2(30) NOT NULL,
    CONSTRAINT "DepartmentFunctionalHead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_Designation" (
    "id"                   VARCHAR2(30)  NOT NULL,
    "title"                VARCHAR2(255) NOT NULL,
    "departmentId"         VARCHAR2(30)  NOT NULL,
    "requiresPsychometric" NUMBER(1)     DEFAULT 0 NOT NULL,
    "isActive"             NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt"            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"            TIMESTAMP     NOT NULL,
    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Designation_requiresPsychometric_chk" CHECK ("requiresPsychometric" IN (0,1)),
    CONSTRAINT "Designation_isActive_chk" CHECK ("isActive" IN (0,1))
);

CREATE TABLE "RECRUIT_T_Role" (
    "id"            VARCHAR2(30)  NOT NULL,
    "key"           VARCHAR2(50)  NOT NULL,
    "label"         VARCHAR2(100) NOT NULL,
    "approvalLevel" VARCHAR2(20),
    "isSystem"      NUMBER(1)     DEFAULT 0 NOT NULL,
    "isActive"      NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt"     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"     TIMESTAMP     NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Role_isSystem_chk" CHECK ("isSystem" IN (0,1)),
    CONSTRAINT "Role_isActive_chk" CHECK ("isActive" IN (0,1)),
    CONSTRAINT "Role_approvalLevel_chk" CHECK ("approvalLevel" IN ('DIVISIONAL','FUNCTIONAL','COUNTRY','COUNTRY_SUPERVISOR','ANY'))
);
-- A genuine UNIQUE constraint (not just a unique index) is required here —
-- Oracle's ADD FOREIGN KEY refuses to reference a column backed only by a
-- unique index, even though the index itself enforces the same uniqueness.
ALTER TABLE "RECRUIT_T_Role" ADD CONSTRAINT "Role_key_key" UNIQUE ("key");

-- permissionKey is validated against the fixed catalog in src/lib/permissions.ts,
-- not a DB-managed list — new capabilities always require a code change anyway.
CREATE TABLE "RECRUIT_T_RolePermission" (
    "id"            VARCHAR2(30) NOT NULL,
    "roleId"        VARCHAR2(30) NOT NULL,
    "permissionKey" VARCHAR2(50) NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_role_perm_key" ON "RECRUIT_T_RolePermission"("roleId", "permissionKey");
ALTER TABLE "RECRUIT_T_RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "RECRUIT_T_Role"("id") ON DELETE CASCADE;

CREATE TABLE "RECRUIT_T_User" (
    "id"           VARCHAR2(30)  NOT NULL,
    "name"         VARCHAR2(255) NOT NULL,
    "userName"     VARCHAR2(255) NOT NULL,
    "email"        VARCHAR2(255) NOT NULL,
    "password"     VARCHAR2(255) NOT NULL,
    "role"         VARCHAR2(50)  DEFAULT 'CANDIDATE' NOT NULL,
    "isActive"     NUMBER(1)     DEFAULT 1 NOT NULL,
    -- Uploaded via Users -> Edit -> Signature (png/jpg/jpeg only); stored on
    -- disk under public/uploads/signatures, this is just the served path.
    "signatureUrl" VARCHAR2(500),
    "createdAt"    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"    TIMESTAMP     NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_isActive_chk" CHECK ("isActive" IN (0,1))
);

-- NextAuth's Account/Session/VerificationToken tables are intentionally
-- omitted: this app uses session: { strategy: "jwt" } with no adapter wired
-- in, so those tables would never be read or written at runtime.

CREATE TABLE "RECRUIT_T_MRF" (
    "id"                         VARCHAR2(30)  NOT NULL,
    -- Two independent sequences: referenceNumber (REF-<year>-<seq>) is
    -- assigned immediately at creation, so every MRF is identifiable from
    -- day one. mrfNumber (MRF-<year>-<seq>) is null until the MRF clears
    -- its final approval stage, assigned there (see approve/route.ts). A
    -- unique index still allows multiple NULLs in Oracle, so many pending
    -- MRFs can coexist unnumbered.
    "referenceNumber"            VARCHAR2(255) NOT NULL,
    "mrfNumber"                  VARCHAR2(255),
    "title"                      VARCHAR2(500) NOT NULL,
    "orgUnitId"                  VARCHAR2(30)  NOT NULL,
    "departmentId"               VARCHAR2(30)  NOT NULL,
    "designationId"              VARCHAR2(30),
    "vacancyCount"               NUMBER(10)    DEFAULT 1 NOT NULL,
    "justification"              CLOB,
    "fillerName"                 VARCHAR2(255),
    "fillerDesignation"          VARCHAR2(255),
    -- Printed on the requisition PDF in place of the "Divisional Head"
    -- signature block — entered at creation time rather than pulled from
    -- the actual digital approval record (see mrf-pdf-document.tsx).
    "approvalSignatureName"        VARCHAR2(255),
    "approvalSignatureDesignation" VARCHAR2(255),
    "status"                     VARCHAR2(50)  DEFAULT 'DRAFT' NOT NULL,
    "createdById"                VARCHAR2(30)  NOT NULL,
    "createdAt"                  TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"                  TIMESTAMP     NOT NULL,
    "approvedAt"                 TIMESTAMP,
    "rejectedAt"                 TIMESTAMP,
    "rejectionReason"            CLOB,
    "vacancyType"                VARCHAR2(255),
    "replacedEmployeeName"       VARCHAR2(255),
    "replacedEmployeeCTC"        VARCHAR2(255),
    "replacementFor"             VARCHAR2(255),
    "replacementReason"          CLOB,
    "replacementNecessityReason" CLOB,
    "isNewRole"                  NUMBER(1)     DEFAULT 0 NOT NULL,
    "isBusinessExpansion"        NUMBER(1)     DEFAULT 0 NOT NULL,
    "newRoleJustification"       CLOB,
    "isBudgeted"                 NUMBER(1),
    "proposedGrade"              VARCHAR2(255),
    "ctcRange"                   VARCHAR2(255),
    "location"                   VARCHAR2(255),
    "reportingTo"                VARCHAR2(255),
    "jobProfile"                 CLOB,
    "minAge"                     NUMBER(10),
    "maxAge"                     NUMBER(10),
    "minQualification"           VARCHAR2(500),
    "preferredQualification"     VARCHAR2(500),
    "workExperience"             VARCHAR2(500),
    "industryBackground"         VARCHAR2(500),
    "otherSpecs"                 CLOB,
    "contributionJustified"      NUMBER(1)     DEFAULT 0 NOT NULL,
    -- Reminder hold ("snooze"): pauses the every-3-days reminder email/notification
    -- to the current stage's approver(s) without blocking Approve/Reject, which
    -- stays available the whole time. holdIndefinite=1 ("until I change") ignores
    -- holdUntil entirely; otherwise the hold auto-lifts once holdUntil passes.
    "holdUntil"                  TIMESTAMP,
    "holdIndefinite"             NUMBER(1)     DEFAULT 0 NOT NULL,
    "heldById"                   VARCHAR2(30),
    "heldAt"                     TIMESTAMP,
    "lastReminderSentAt"         TIMESTAMP,
    CONSTRAINT "MRF_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MRF_isNewRole_chk" CHECK ("isNewRole" IN (0,1)),
    CONSTRAINT "MRF_isBusinessExpansion_chk" CHECK ("isBusinessExpansion" IN (0,1)),
    CONSTRAINT "MRF_isBudgeted_chk" CHECK ("isBudgeted" IN (0,1)),
    CONSTRAINT "MRF_contributionJustified_chk" CHECK ("contributionJustified" IN (0,1)),
    CONSTRAINT "MRF_holdIndefinite_chk" CHECK ("holdIndefinite" IN (0,1))
);

CREATE TABLE "RECRUIT_T_Candidate" (
    "id"              VARCHAR2(30)  NOT NULL,
    "userId"          VARCHAR2(30)  NOT NULL,
    "mrfId"           VARCHAR2(30),
    "firstName"       VARCHAR2(255) NOT NULL,
    "lastName"        VARCHAR2(255) NOT NULL,
    "email"           VARCHAR2(255) NOT NULL,
    "phone"           VARCHAR2(50),
    "currentStage"    VARCHAR2(50)  DEFAULT 'APPLIED' NOT NULL,
    "aiScore"         NUMBER,
    "aiScoreNotes"    CLOB,
    "resumeUrl"       VARCHAR2(500),
    "isActive"        NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt"       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"       TIMESTAMP     NOT NULL,
    "candidateStatus" VARCHAR2(50)  DEFAULT 'ACTIVE' NOT NULL,
    "statusNote"      CLOB,
    "interviewDate"   TIMESTAMP,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Candidate_isActive_chk" CHECK ("isActive" IN (0,1))
);

CREATE TABLE "RECRUIT_T_Document" (
    "id"             VARCHAR2(30)  NOT NULL,
    "name"           VARCHAR2(255) NOT NULL,
    "fileUrl"        VARCHAR2(500) NOT NULL,
    "fileType"       VARCHAR2(100) NOT NULL,
    "fileSize"       NUMBER(10)    NOT NULL,
    "documentType"   VARCHAR2(50)  DEFAULT 'OTHER' NOT NULL,
    "uploadedById"   VARCHAR2(30)  NOT NULL,
    "candidateId"    VARCHAR2(30),
    "mrfId"          VARCHAR2(30),
    "approvalStatus" VARCHAR2(50)  DEFAULT 'PENDING' NOT NULL,
    "approvalNotes"  CLOB,
    "extractedData"  CLOB,
    "createdAt"      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_MRFApprovalRecord" (
    "id"                  VARCHAR2(30)  NOT NULL,
    "mrfId"               VARCHAR2(30)  NOT NULL,
    "level"               VARCHAR2(50)  NOT NULL,
    "approverRole"        VARCHAR2(50),
    "approverId"          VARCHAR2(30),
    "approverName"        VARCHAR2(255) NOT NULL,
    "approverDesignation" VARCHAR2(255),
    "status"              VARCHAR2(50)  DEFAULT 'PENDING' NOT NULL,
    "notes"               CLOB,
    "recordedById"        VARCHAR2(30)  NOT NULL,
    "recordedAt"          TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "documentId"          VARCHAR2(30),
    CONSTRAINT "MRFApprovalRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_CandidateStageHistory" (
    "id"          VARCHAR2(30) NOT NULL,
    "candidateId" VARCHAR2(30) NOT NULL,
    "fromStage"   VARCHAR2(50),
    "toStage"     VARCHAR2(50) NOT NULL,
    "notes"       CLOB,
    "changedAt"   TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT "CandidateStageHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_InterviewRecord" (
    "id"            VARCHAR2(30)  NOT NULL,
    "candidateId"   VARCHAR2(30)  NOT NULL,
    "interviewerId" VARCHAR2(30)  NOT NULL,
    "scheduledAt"   TIMESTAMP     NOT NULL,
    "completedAt"   TIMESTAMP,
    "result"        VARCHAR2(255),
    "notes"         CLOB,
    "createdAt"     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT "InterviewRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_OfferDetail" (
    "id"             VARCHAR2(30) NOT NULL,
    "candidateId"    VARCHAR2(30) NOT NULL,
    "offeredSalary"  NUMBER,
    "offeredAt"      TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
    "acceptedAt"     TIMESTAMP,
    "probationEndAt" TIMESTAMP,
    "notes"          CLOB,
    CONSTRAINT "OfferDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_Employee" (
    "id"             VARCHAR2(30)  NOT NULL,
    "candidateId"    VARCHAR2(30)  NOT NULL,
    "employeeCode"   VARCHAR2(255) NOT NULL,
    "joiningDate"    TIMESTAMP     NOT NULL,
    "department"     VARCHAR2(255),
    "designation"    VARCHAR2(255),
    "ctc"            NUMBER,
    "reportingTo"    VARCHAR2(255),
    "orgUnitId"      VARCHAR2(30),
    "isActive"       NUMBER(1)     DEFAULT 1 NOT NULL,
    "onboardingStep" NUMBER(10)    DEFAULT 0 NOT NULL,
    "employeeType"   VARCHAR2(50)  DEFAULT 'INDIA' NOT NULL,
    "createdAt"      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"      TIMESTAMP     NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Employee_isActive_chk" CHECK ("isActive" IN (0,1))
);

CREATE TABLE "RECRUIT_T_EmployeeOnboardingData" (
    "id"          VARCHAR2(30) NOT NULL,
    "employeeId"  VARCHAR2(30) NOT NULL,
    "formData"    CLOB         NOT NULL,
    "submittedAt" TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"   TIMESTAMP    NOT NULL,
    CONSTRAINT "EmployeeOnboardingData_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RECRUIT_T_Email" (
    "id"          VARCHAR2(30)  NOT NULL,
    "fromId"      VARCHAR2(30)  NOT NULL,
    "toEmail"     VARCHAR2(255) NOT NULL,
    "subject"     VARCHAR2(500) NOT NULL,
    "body"        CLOB          NOT NULL,
    "isRead"      NUMBER(1)     DEFAULT 0 NOT NULL,
    "sentAt"      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "candidateId" VARCHAR2(30),
    "mrfId"       VARCHAR2(30), -- no FK: no @relation declared in schema.prisma
    CONSTRAINT "Email_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Email_isRead_chk" CHECK ("isRead" IN (0,1))
);

CREATE TABLE "RECRUIT_T_WorkflowStage" (
    "id"        VARCHAR2(30)  NOT NULL,
    "key"       VARCHAR2(255) NOT NULL,
    "label"     VARCHAR2(255) NOT NULL,
    "stepOrder" NUMBER(10)    NOT NULL,
    "isActive"  NUMBER(1)     DEFAULT 1 NOT NULL,
    "createdAt" TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP     NOT NULL,
    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowStage_isActive_chk" CHECK ("isActive" IN (0,1))
);

CREATE TABLE "RECRUIT_T_Notification" (
    "id"        VARCHAR2(30)  NOT NULL,
    "userId"    VARCHAR2(30)  NOT NULL,
    "type"      VARCHAR2(100) NOT NULL,
    "title"     VARCHAR2(255) NOT NULL,
    "message"   CLOB          NOT NULL,
    "link"      VARCHAR2(500),
    "isRead"    NUMBER(1)     DEFAULT 0 NOT NULL,
    "createdAt" TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_isRead_chk" CHECK ("isRead" IN (0,1))
);

CREATE TABLE "RECRUIT_T_DocumentTemplate" (
    "id"           VARCHAR2(30)  NOT NULL,
    "name"         VARCHAR2(255) NOT NULL,
    "description"  CLOB,
    "templateType" VARCHAR2(100) NOT NULL,
    "fileUrl"      VARCHAR2(500) NOT NULL,
    "fileSize"     NUMBER(10)    NOT NULL,
    "isActive"     NUMBER(1)     DEFAULT 1 NOT NULL,
    "uploadedById" VARCHAR2(30)  NOT NULL,
    "createdAt"    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    "updatedAt"    TIMESTAMP     NOT NULL,
    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentTemplate_isActive_chk" CHECK ("isActive" IN (0,1))
);

-- ============================================================================
-- UNIQUE INDEXES  (mirrors Prisma's @unique / @@unique)
-- ============================================================================

CREATE UNIQUE INDEX "OrgUnit_parentId_name_key" ON "RECRUIT_T_OrgUnit"("parentId", "name");
CREATE UNIQUE INDEX "UserOrgUnit_userId_orgUnitId_key" ON "RECRUIT_T_UserOrgUnit"("userId", "orgUnitId");
CREATE UNIQUE INDEX "Department_name_key" ON "RECRUIT_T_Department"("name");
CREATE UNIQUE INDEX "DepartmentFunctionalHead_dept_user_key" ON "RECRUIT_T_DepartmentFunctionalHead"("departmentId", "userId");
CREATE UNIQUE INDEX "Designation_title_key" ON "RECRUIT_T_Designation"("title");
CREATE UNIQUE INDEX "User_email_key" ON "RECRUIT_T_User"("email");
CREATE UNIQUE INDEX "User_userName_key" ON "RECRUIT_T_User"("userName");
CREATE UNIQUE INDEX "MRF_referenceNumber_key" ON "RECRUIT_T_MRF"("referenceNumber");
CREATE UNIQUE INDEX "MRF_mrfNumber_key" ON "RECRUIT_T_MRF"("mrfNumber");
CREATE UNIQUE INDEX "Candidate_userId_key" ON "RECRUIT_T_Candidate"("userId");
CREATE UNIQUE INDEX "Candidate_email_key" ON "RECRUIT_T_Candidate"("email");
CREATE UNIQUE INDEX "OfferDetail_candidateId_key" ON "RECRUIT_T_OfferDetail"("candidateId");
CREATE UNIQUE INDEX "Employee_candidateId_key" ON "RECRUIT_T_Employee"("candidateId");
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "RECRUIT_T_Employee"("employeeCode");
CREATE UNIQUE INDEX "EmployeeOnboardingData_empId_key" ON "RECRUIT_T_EmployeeOnboardingData"("employeeId");
CREATE UNIQUE INDEX "WorkflowStage_key_key" ON "RECRUIT_T_WorkflowStage"("key");

-- ============================================================================
-- FOREIGN KEYS
-- Added after all tables exist so creation order doesn't matter
-- (MRFApprovalRecord <-> Document reference each other).
-- Oracle has no ON UPDATE action; ON DELETE RESTRICT is simply omitted.
-- ============================================================================

ALTER TABLE "RECRUIT_T_OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "RECRUIT_T_OrgUnit"("id");

ALTER TABLE "RECRUIT_T_UserOrgUnit" ADD CONSTRAINT "UserOrgUnit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "RECRUIT_T_User"("id") ON DELETE CASCADE;
ALTER TABLE "RECRUIT_T_UserOrgUnit" ADD CONSTRAINT "UserOrgUnit_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "RECRUIT_T_OrgUnit"("id") ON DELETE CASCADE;

ALTER TABLE "RECRUIT_T_DepartmentFunctionalHead" ADD CONSTRAINT "DeptFuncHead_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "RECRUIT_T_Department"("id");
ALTER TABLE "RECRUIT_T_DepartmentFunctionalHead" ADD CONSTRAINT "DeptFuncHead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "RECRUIT_T_User"("id");

ALTER TABLE "RECRUIT_T_Designation" ADD CONSTRAINT "Designation_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "RECRUIT_T_Department"("id");

ALTER TABLE "RECRUIT_T_User" ADD CONSTRAINT "User_role_fkey"
    FOREIGN KEY ("role") REFERENCES "RECRUIT_T_Role"("key");

ALTER TABLE "RECRUIT_T_MRF" ADD CONSTRAINT "MRF_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "RECRUIT_T_OrgUnit"("id");
ALTER TABLE "RECRUIT_T_MRF" ADD CONSTRAINT "MRF_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "RECRUIT_T_Department"("id");
ALTER TABLE "RECRUIT_T_MRF" ADD CONSTRAINT "MRF_designationId_fkey"
    FOREIGN KEY ("designationId") REFERENCES "RECRUIT_T_Designation"("id") ON DELETE SET NULL;
ALTER TABLE "RECRUIT_T_MRF" ADD CONSTRAINT "MRF_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "RECRUIT_T_User"("id");
ALTER TABLE "RECRUIT_T_MRF" ADD CONSTRAINT "MRF_heldById_fkey"
    FOREIGN KEY ("heldById") REFERENCES "RECRUIT_T_User"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_Candidate" ADD CONSTRAINT "Candidate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "RECRUIT_T_User"("id");
ALTER TABLE "RECRUIT_T_Candidate" ADD CONSTRAINT "Candidate_mrfId_fkey"
    FOREIGN KEY ("mrfId") REFERENCES "RECRUIT_T_MRF"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_Document" ADD CONSTRAINT "Document_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "RECRUIT_T_User"("id");
ALTER TABLE "RECRUIT_T_Document" ADD CONSTRAINT "Document_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id") ON DELETE SET NULL;
ALTER TABLE "RECRUIT_T_Document" ADD CONSTRAINT "Document_mrfId_fkey"
    FOREIGN KEY ("mrfId") REFERENCES "RECRUIT_T_MRF"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_MRFApprovalRecord" ADD CONSTRAINT "MRFApprovalRecord_mrfId_fkey"
    FOREIGN KEY ("mrfId") REFERENCES "RECRUIT_T_MRF"("id");
ALTER TABLE "RECRUIT_T_MRFApprovalRecord" ADD CONSTRAINT "MRFApprovalRecord_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "RECRUIT_T_User"("id") ON DELETE SET NULL;
ALTER TABLE "RECRUIT_T_MRFApprovalRecord" ADD CONSTRAINT "MRFApprovalRecord_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "RECRUIT_T_User"("id");
ALTER TABLE "RECRUIT_T_MRFApprovalRecord" ADD CONSTRAINT "MRFApprovalRecord_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "RECRUIT_T_Document"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_CandidateStageHistory" ADD CONSTRAINT "CandidateStageHistory_candId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id");

ALTER TABLE "RECRUIT_T_InterviewRecord" ADD CONSTRAINT "InterviewRecord_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id");
ALTER TABLE "RECRUIT_T_InterviewRecord" ADD CONSTRAINT "InterviewRecord_interviewerId_fkey"
    FOREIGN KEY ("interviewerId") REFERENCES "RECRUIT_T_User"("id");

ALTER TABLE "RECRUIT_T_OfferDetail" ADD CONSTRAINT "OfferDetail_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id");

ALTER TABLE "RECRUIT_T_Employee" ADD CONSTRAINT "Employee_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id");
ALTER TABLE "RECRUIT_T_Employee" ADD CONSTRAINT "Employee_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "RECRUIT_T_OrgUnit"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_EmployeeOnboardingData" ADD CONSTRAINT "EmployeeOnboardingData_empId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "RECRUIT_T_Employee"("id");

ALTER TABLE "RECRUIT_T_Email" ADD CONSTRAINT "Email_fromId_fkey"
    FOREIGN KEY ("fromId") REFERENCES "RECRUIT_T_User"("id");
ALTER TABLE "RECRUIT_T_Email" ADD CONSTRAINT "Email_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "RECRUIT_T_Candidate"("id") ON DELETE SET NULL;

ALTER TABLE "RECRUIT_T_Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "RECRUIT_T_User"("id");

ALTER TABLE "RECRUIT_T_DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "RECRUIT_T_User"("id");
