# RecruitPro ERP — Complete Reconstruction Context

> Give this file to any AI assistant to fully understand and recreate the project one-to-one.
> Everything needed to rebuild is in this document — architecture, schema, every API, every page, every business rule.

---

## 1. What This Project Is

**RecruitPro ERP** is a full-stack multi-role recruitment and employee management system for a mid-to-large enterprise (Primawave group). It covers the entire hiring lifecycle:

- Raise a Manpower Requisition Form (MRF) → 3-level approval chain
- Manage candidates through a 15-stage pipeline
- Onboard joined employees with a document + form flow
- HR/Admin document management with approval workflow
- In-app email with Gmail SMTP delivery

**Primary users:**

| Role | Description |
|---|---|
| ADMIN | Full access to everything |
| HR | Manage MRFs, candidates, emails, documents, employees |
| BRANCH_MANAGER | Raise MRFs for their branch |
| DIVISIONAL_MANAGER | Approve MRFs at divisional level |
| FUNCTIONAL_HEAD | Approve MRFs at functional level |
| COUNTRY_MANAGER | Final MRF approver (also called "Universal Manager"; can raise MRFs too) |
| CANDIDATE | View own application pipeline, upload pre-shortlist documents |
| EMPLOYEE | Complete onboarding (3-step: upload docs → fill form → dashboard) |

---

## 2. Exact Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.7 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | v4 (PostCSS plugin) |
| UI Components | shadcn/ui (Radix UI + CVA) | various |
| Icons | lucide-react | 1.17.0 |
| ORM | Prisma | 7.8.0 |
| DB adapter | @prisma/adapter-libsql | 7.8.0 |
| LibSQL client | @libsql/client | 0.17.3 |
| Database | SQLite | (file: dev.db) |
| Auth | next-auth | 4.24.14 |
| Auth adapter | @auth/prisma-adapter | 2.11.2 |
| Password hashing | bcryptjs | 3.0.3 |
| Email sending | nodemailer | 7.0.13 |
| Date utils | date-fns | 4.4.0 |
| Class utils | clsx + tailwind-merge | latest |

**Key `package.json` dependencies also present but minimally used:**
- `react-hook-form`, `zod`, `@hookform/resolvers` — installed, not wired up in most forms
- `multer` — installed but NOT used; file uploads are handled via native `req.formData()`
- `better-sqlite3` — in deps as fallback

---

## 3. Architecture

### System Diagram
```
Browser (React 19 / Next.js App Router)
    │  HTTP / fetch()
    ▼
Next.js Server (Node.js)
  ├── App Router pages  ← RSC for auth-gated + "use client" for interactive
  ├── /api/* Route Handlers  ← all REST endpoints
  ├── NextAuth.js  ← JWT cookie auth
  └── Prisma ORM (LibSQL adapter)
        │
        ▼
    dev.db (SQLite)       public/uploads/  (local file storage)
```

### Critical Patterns

**1. Stale Prisma client after migration**
After `npx prisma migrate dev`, you must run `npx prisma generate` to regenerate the client. Until regenerated, use `prisma.$queryRawUnsafe()` for new fields. This is a recurring pattern throughout the codebase — many routes use raw SQL for new columns (e.g. `documentType`, `extractedData`, `fillerName`, `approverRole`).

**2. Dynamic params are Promises (Next.js 16)**
```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // must await
}
```

**3. File upload — no multer, native FormData**
```typescript
const formData = await req.formData();
const file = formData.get("file") as File | null;
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);
await writeFile(filePath, buffer);
```

**4. Auth check on every API route**
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const role = (session.user as { role?: string })?.role || "";
const userId = (session.user as { id?: string })?.id!;
```

**5. Notification INSERT — must include `type` column (NOT NULL)**
```typescript
await prisma.$queryRawUnsafe(
  `INSERT INTO Notification (id, userId, type, title, message, link, isRead, createdAt) VALUES (?, ?, 'MRF_APPROVAL', ?, ?, ?, 0, ?)`,
  notifId, userId, title, message, link, now
);
```
Missing `type` causes a SQLite NOT NULL constraint → 500 → frontend JSON.parse crash. Always use raw SQL with all 8 columns.

---

## 4. Database Schema (complete)

### prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

model Country {
  id           String   @id @default(cuid())
  name         String   @unique
  code         String   @unique
  locationType String   @default("OVERSEAS")  // INDIA | OVERSEAS | CORPORATE
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  divisions          Division[]
  branches           Branch[]
  users              User[]
  mrfs               MRF[]
  countryAssignments UserCountryAssignment[]
}

model Division {
  id        String   @id @default(cuid())
  name      String
  countryId String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  country  Country  @relation(fields: [countryId], references: [id])
  states   State[]
  mrfs     MRF[]
  branches Branch[]

  @@unique([name, countryId])
}

model State {
  id         String   @id @default(cuid())
  name       String
  divisionId String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  division Division @relation(fields: [divisionId], references: [id])
  branches Branch[]

  @@unique([name, divisionId])
}

model Branch {
  id         String   @id @default(cuid())
  name       String
  code       String   @unique
  countryId  String
  stateId    String?
  divisionId String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  country   Country   @relation(fields: [countryId], references: [id])
  state     State?    @relation(fields: [stateId], references: [id])
  division  Division? @relation(fields: [divisionId], references: [id])
  users     User[]
  mrfs      MRF[]
  employees Employee[]
}

model Department {
  id        String   @id @default(cuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mrfs                   MRF[]
  functionalHeadMappings DepartmentFunctionalHead[]
  designations           Designation[]
}

model DepartmentFunctionalHead {
  id           String  @id @default(cuid())
  departmentId String
  userId       String
  countryId    String?
  stateId      String?

  department Department @relation(fields: [departmentId], references: [id])
  user       User       @relation(fields: [userId], references: [id])

  @@unique([departmentId, userId])
}

model Designation {
  id                   String   @id @default(cuid())
  title                String   @unique
  departmentId         String
  requiresPsychometric Boolean  @default(false)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  department Department @relation(fields: [departmentId], references: [id])
  mrfs       MRF[]
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String   // bcrypt hash
  role      String   @default("CANDIDATE")
  branchId  String?
  countryId String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch   Branch?  @relation(fields: [branchId], references: [id])
  country  Country? @relation(fields: [countryId], references: [id])

  sessions           Session[]
  accounts           Account[]
  createdMRFs        MRF[]                    @relation("MRFCreator")
  functionalHeadOf   DepartmentFunctionalHead[]
  countryAssignments UserCountryAssignment[]
  candidateProfile   Candidate?
  mrfApprovalRecords MRFApprovalRecord[]      @relation("ApproverRecords")
  recordedApprovals  MRFApprovalRecord[]      @relation("RecorderRecords")
  uploadedDocuments  Document[]               @relation("UploadedBy")
  interviews         InterviewRecord[]
  sentEmails         Email[]                  @relation("SentEmails")
  notifications      Notification[]
  uploadedTemplates  DocumentTemplate[]       @relation("TemplateUploadedBy")
}

model UserCountryAssignment {
  id        String @id @default(cuid())
  userId    String
  countryId String
  user    User    @relation(fields: [userId], references: [id])
  country Country @relation(fields: [countryId], references: [id])
  @@unique([userId, countryId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model MRF {
  id                         String    @id @default(cuid())
  mrfNumber                  String    @unique  // format: MRF-YYYY-NNNN
  title                      String
  countryId                  String
  divisionId                 String?
  branchId                   String?
  departmentId               String
  designationId              String?
  vacancyCount               Int       @default(1)
  justification              String?
  fillerName                 String?
  fillerDesignation          String?
  status                     String    @default("DRAFT")
  // status values: DRAFT | PENDING_DIVISIONAL | PENDING_FUNCTIONAL | PENDING_COUNTRY | APPROVED | REJECTED
  createdById                String
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt
  approvedAt                 DateTime?
  rejectedAt                 DateTime?
  rejectionReason            String?
  vacancyType                String?   // REPLACEMENT | NEW_POSITION
  replacedEmployeeName       String?
  replacedEmployeeCTC        String?
  replacementFor             String?
  replacementReason          String?   // RESIGNATION | TRANSFER | RETIREMENT
  replacementNecessityReason String?
  isNewRole                  Boolean   @default(false)
  isBusinessExpansion        Boolean   @default(false)
  newRoleJustification       String?
  isBudgeted                 Boolean?
  proposedGrade              String?
  ctcRange                   String?
  location                   String?
  reportingTo                String?
  jobProfile                 String?
  minAge                     Int?
  maxAge                     Int?
  minQualification           String?
  preferredQualification     String?
  workExperience             String?
  industryBackground         String?
  otherSpecs                 String?
  contributionJustified      Boolean   @default(false)

  country     Country      @relation(fields: [countryId], references: [id])
  division    Division?    @relation(fields: [divisionId], references: [id])
  branch      Branch?      @relation(fields: [branchId], references: [id])
  department  Department   @relation(fields: [departmentId], references: [id])
  designation Designation? @relation(fields: [designationId], references: [id])
  createdBy   User         @relation("MRFCreator", fields: [createdById], references: [id])

  approvalRecords MRFApprovalRecord[]
  candidates      Candidate[]
  documents       Document[]
}

model MRFApprovalRecord {
  id                  String   @id @default(cuid())
  mrfId               String
  level               String   // DIVISIONAL_MANAGER | FUNCTIONAL_HEAD | COUNTRY_MANAGER
  approverRole        String?
  approverId          String?
  approverName        String
  approverDesignation String?
  status              String   @default("PENDING")  // APPROVED | REJECTED
  notes               String?
  recordedById        String
  recordedAt          DateTime @default(now())
  documentId          String?

  mrf        MRF       @relation(fields: [mrfId], references: [id])
  approver   User?     @relation("ApproverRecords", fields: [approverId], references: [id])
  recordedBy User      @relation("RecorderRecords", fields: [recordedById], references: [id])
  document   Document? @relation(fields: [documentId], references: [id])
}

model Candidate {
  id              String    @id @default(cuid())
  userId          String    @unique
  mrfId           String?
  firstName       String
  lastName        String
  email           String    @unique
  phone           String?
  currentStage    String    @default("APPLIED")
  aiScore         Float?
  aiScoreNotes    String?
  resumeUrl       String?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  candidateStatus String    @default("ACTIVE")  // ACTIVE | REJECTED | ON_HOLD
  statusNote      String?
  interviewDate   DateTime?

  user         User                    @relation(fields: [userId], references: [id])
  mrf          MRF?                    @relation(fields: [mrfId], references: [id])
  stageHistory CandidateStageHistory[]
  interviews   InterviewRecord[]
  documents    Document[]
  offerDetail  OfferDetail?
  employee     Employee?
  emails       Email[]
}

model CandidateStageHistory {
  id          String   @id @default(cuid())
  candidateId String
  fromStage   String?
  toStage     String
  notes       String?
  changedAt   DateTime @default(now())
  candidate Candidate @relation(fields: [candidateId], references: [id])
}

model InterviewRecord {
  id            String    @id @default(cuid())
  candidateId   String
  interviewerId String
  scheduledAt   DateTime
  completedAt   DateTime?
  result        String?
  notes         String?
  createdAt     DateTime  @default(now())
  candidate   Candidate @relation(fields: [candidateId], references: [id])
  interviewer User      @relation(fields: [interviewerId], references: [id])
}

model OfferDetail {
  id             String    @id @default(cuid())
  candidateId    String    @unique
  offeredSalary  Float?
  offeredAt      DateTime  @default(now())
  acceptedAt     DateTime?
  probationEndAt DateTime?
  notes          String?
  candidate Candidate @relation(fields: [candidateId], references: [id])
}

model Document {
  id             String   @id @default(cuid())
  name           String
  fileUrl        String   // /uploads/{timestamp}-{sanitized-name}
  fileType       String
  fileSize       Int
  documentType   String   @default("OTHER")
  uploadedById   String
  candidateId    String?
  mrfId          String?
  approvalStatus String   @default("PENDING")  // PENDING | APPROVED | REJECTED
  approvalNotes  String?
  extractedData  String?  // JSON string of extracted fields (for AADHAAR, PAN, PASSPORT, BANK_DETAILS)
  createdAt      DateTime @default(now())

  uploadedBy      User               @relation("UploadedBy", fields: [uploadedById], references: [id])
  candidate       Candidate?         @relation(fields: [candidateId], references: [id])
  mrf             MRF?               @relation(fields: [mrfId], references: [id])
  approvalRecords MRFApprovalRecord[]
}

model Employee {
  id             String   @id @default(cuid())
  candidateId    String   @unique
  employeeCode   String   @unique  // format: EMP-NNNN
  joiningDate    DateTime
  department     String?  // free text (not FK)
  designation    String?  // free text (not FK)
  ctc            Float?
  reportingTo    String?
  branchId       String?
  isActive       Boolean  @default(true)
  onboardingStep Int      @default(0)  // 0=upload docs, 1=fill form, 2=complete
  employeeType   String   @default("INDIA")  // INDIA | OVERSEAS
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  candidate      Candidate               @relation(fields: [candidateId], references: [id])
  branch         Branch?                 @relation(fields: [branchId], references: [id])
  onboardingData EmployeeOnboardingData?
}

model Email {
  id          String   @id @default(cuid())
  fromId      String
  toEmail     String
  subject     String
  body        String
  isRead      Boolean  @default(false)
  sentAt      DateTime @default(now())
  candidateId String?
  mrfId       String?  // linked MRF (email system uses MRF selector, not candidate selector)

  from      User       @relation("SentEmails", fields: [fromId], references: [id])
  candidate Candidate? @relation(fields: [candidateId], references: [id])
  // Note: mrf relation not in Prisma schema yet — use raw SQL JOIN when fetching
}

model EmployeeOnboardingData {
  id          String   @id @default(cuid())
  employeeId  String   @unique
  formData    String   // JSON stringified form submission
  submittedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
  employee Employee @relation(fields: [employeeId], references: [id])
}

model WorkflowStage {
  id        String   @id @default(cuid())
  key       String   @unique
  label     String
  stepOrder Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // NOT NULL — always provide, e.g. 'MRF_APPROVAL'
  title     String
  message   String
  link      String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
}

model DocumentTemplate {
  id           String   @id @default(cuid())
  name         String
  description  String?
  templateType String   // AADHAAR | PAN | PASSPORT | BANK_DETAILS | APPOINTMENT_LETTER | OTHERS
  fileUrl      String
  fileSize     Int
  isActive     Boolean  @default(true)
  uploadedById String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  uploadedBy User @relation("TemplateUploadedBy", fields: [uploadedById], references: [id])
}
```

---

## 5. Environment Variables

### .env (complete)
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="recruitpro-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Gmail SMTP — uses Google App Password (2FA must be enabled on account)
# App password entered WITHOUT spaces (remove the spaces from the 16-char code)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=recruitprov2@gmail.com
SMTP_PASS=kgwfynbsyaohvprc
SMTP_FROM=recruitprov2@gmail.com
```

### SMTP Notes
- Gmail requires a **Google App Password**, not the account password
- Must have 2FA enabled on the Gmail account
- Port 587 + `SMTP_SECURE=false` = STARTTLS (upgrades connection after connect) — correct for Gmail
- All email-sending code checks `if (process.env.SMTP_HOST)` before attempting; failure is non-fatal
- Emails always recorded in the `Email` DB table regardless of SMTP success

---

## 6. Authentication

**File:** `src/lib/auth.ts`

- NextAuth v4, CredentialsProvider, JWT strategy
- Login: `{ email, password }` → find User by email → check `isActive` → bcrypt compare → return `{ id, name, email, role }`
- JWT callback: adds `id` and `role` to token
- Session callback: adds `id` and `role` to session.user
- Session shape: `{ user: { id, name, email, role } }`

**File:** `src/lib/prisma.ts`
- Singleton Prisma client using `@prisma/adapter-libsql`
- `createClient({ url: "file:" + path.resolve("./dev.db") })`
- Exported as `prisma`

**Quick-login demo accounts** (seeded by `/api/seed`):
| Email | Password | Role |
|---|---|---|
| admin@recruitpro.com | admin123 | ADMIN |
| hr@recruitpro.com | hr123 | HR |
| bm@recruitpro.com | bm123 | BRANCH_MANAGER |
| dm@recruitpro.com | dm123 | DIVISIONAL_MANAGER |
| candidate@recruitpro.com | candidate123 | CANDIDATE |
| employee@recruitpro.com | emp123 | EMPLOYEE |

---

## 7. Complete File Structure

```
recruitpro-erp/
├── dev.db                                     # SQLite database
├── .env                                       # All env vars including Gmail SMTP
├── prisma/
│   ├── schema.prisma
│   └── migrations/                            # All Prisma migrations
├── public/
│   └── uploads/                               # Uploaded files (auto-created)
├── context.md                                 # This file
├── PROJECT_CONTEXT.md                         # Legacy context (older, less complete)
└── src/
    ├── app/
    │   ├── layout.tsx                         # Root layout: Inter font, Providers
    │   ├── page.tsx                           # Root: redirect to /dashboard or /login
    │   ├── globals.css                        # Tailwind directives
    │   ├── login/page.tsx                     # Login with quick-access buttons
    │   ├── api/
    │   │   ├── auth/[...nextauth]/route.ts    # NextAuth handler
    │   │   ├── candidates/
    │   │   │   ├── route.ts                   # GET list, POST create
    │   │   │   └── [id]/
    │   │   │       ├── route.ts               # GET detail, PATCH update
    │   │   │       └── stage/route.ts         # POST advance stage
    │   │   ├── documents/
    │   │   │   ├── route.ts                   # GET list, POST upload (with PDF extraction)
    │   │   │   └── [id]/route.ts              # PATCH approve/reject, DELETE
    │   │   ├── emails/route.ts                # GET sent, POST send (Gmail SMTP)
    │   │   ├── employees/
    │   │   │   ├── route.ts                   # GET list, POST create
    │   │   │   ├── [id]/route.ts              # PATCH update (onboardingStep etc)
    │   │   │   └── me/route.ts                # GET own employee + docs (includes documentType, approvalStatus, extractedData)
    │   │   ├── mrfs/
    │   │   │   ├── route.ts                   # GET list, POST create (ADMIN/HR/BRANCH_MANAGER/COUNTRY_MANAGER)
    │   │   │   └── [id]/
    │   │   │       ├── route.ts               # GET detail, PATCH update
    │   │   │       ├── approve/route.ts       # POST approve or reject
    │   │   │       ├── send-approval-email/route.ts  # POST send email with MRF link
    │   │   │       └── restart/route.ts       # POST restart rejected MRF (ADMIN/HR only)
    │   │   ├── org/
    │   │   │   ├── branches/
    │   │   │   │   ├── route.ts               # GET (divisionId filter), POST create
    │   │   │   │   └── [id]/route.ts          # DELETE (blocks if users/MRFs reference it)
    │   │   │   ├── countries/route.ts
    │   │   │   ├── departments/route.ts
    │   │   │   ├── designations/route.ts
    │   │   │   ├── divisions/route.ts
    │   │   │   └── states/route.ts
    │   │   ├── users/
    │   │   │   ├── route.ts                   # GET list (incl. email for autocomplete), POST create
    │   │   │   └── [id]/route.ts              # PATCH update
    │   │   └── seed/
    │   │       ├── route.ts                   # POST initial seed
    │   │       ├── extend-org/route.ts        # POST extend org
    │   │       └── fix-org/route.ts           # POST fix org (ADMIN)
    │   └── dashboard/
    │       ├── layout.tsx                     # Auth guard + shell (Sidebar + Topbar)
    │       ├── page.tsx                       # Role-adaptive home dashboard
    │       ├── mrfs/
    │       │   ├── page.tsx                   # MRF list
    │       │   ├── new/page.tsx               # Create MRF form (+ Send for Approval modal)
    │       │   └── [id]/page.tsx              # MRF detail (+ Send to Next Approver modal, Print, Restart)
    │       ├── candidates/
    │       │   ├── page.tsx                   # Candidate list (email autocomplete on Add)
    │       │   └── [id]/page.tsx              # Candidate detail
    │       ├── employees/page.tsx             # Employee list (structured profile view)
    │       ├── employee-portal/page.tsx       # 3-step onboarding (EMPLOYEE role)
    │       ├── email/page.tsx                 # Email log + compose (MRF-linked, not candidate-linked)
    │       ├── documents/page.tsx             # Document management (shows extractedData)
    │       ├── reports/page.tsx               # Stats (server component)
    │       ├── users/page.tsx                 # User management
    │       ├── settings/page.tsx              # System info
    │       └── org/
    │           ├── countries/page.tsx
    │           ├── departments/page.tsx
    │           └── designations/page.tsx
    ├── components/
    │   ├── layout/
    │   │   ├── sidebar.tsx                    # Dark sidebar, role-based nav, collapsible org menu
    │   │   └── topbar.tsx                     # White topbar with page title
    │   ├── providers.tsx                      # NextAuth SessionProvider
    │   └── ui/                                # shadcn/ui components (button, card, dialog, input, etc.)
    └── lib/
        ├── auth.ts                            # NextAuth config
        ├── prisma.ts                          # Prisma singleton
        ├── utils.ts                           # cn(), formatDate(), CANDIDATE_STAGES, MRF_STATUSES, USER_ROLES
        └── extract-document.ts               # PDF text extraction (pdf-parse dynamic import)
```

---

## 8. All API Routes (complete spec)

### `GET /api/users`
- Auth: ADMIN, HR
- Returns: all users with branch.name, country.name
- Used for: email autocomplete in Add Candidate dialog (filters by email prefix)

### `POST /api/users`
- Auth: ADMIN, HR
- Body: `{ name, email, password, userRole, branchId?, countryId?, departmentId?, divisionId? }`
- HR cannot create ADMIN. Password bcrypt-hashed (10 rounds).
- If `userRole === FUNCTIONAL_HEAD && departmentId`: creates DepartmentFunctionalHead record

### `PATCH /api/users/[id]`
- Auth: ADMIN, HR. HR cannot edit/assign ADMIN role.

---

### `GET /api/candidates`
- Auth: ADMIN, HR
- Query: `stage?`, `mrfId?`
- Returns: candidates with user, mrf (dept, branch.state, country), stageHistory, employee

### `POST /api/candidates`
- Auth: ADMIN, HR
- Body: `{ firstName, lastName, email, phone?, mrfId? }`
- Auto-creates User (role=CANDIDATE, random temp password) if email not found
- Creates Candidate + initial CandidateStageHistory (toStage: APPLIED)

### `GET /api/candidates/[id]`
- Auth: any session. CANDIDATE sees only own profile.

### `PATCH /api/candidates/[id]`
- Auth: ADMIN, HR
- Special: `newPassword` → applies to linked User

### `POST /api/candidates/[id]/stage`
- Auth: ADMIN, HR
- Body: `{ toStage, notes? }`
- Stage index must be > current stage index in CANDIDATE_STAGES

---

### `GET /api/documents`
- Auth: ADMIN/HR see all; CANDIDATE/EMPLOYEE see own only

### `POST /api/documents`
- Auth: any session. Content-Type: multipart/form-data
- FormData: `file`, `documentType`, `candidateId?`, `mrfId?`
- CANDIDATE: own profile only, only pre-SHORTLISTED stages
- EMPLOYEE: own profile only (onboarding)
- ADMIN/HR: any, auto-approved
- Saves to `public/uploads/{timestamp}-{sanitized-name}`
- PDF extraction: if documentType is AADHAAR/PAN/PASSPORT/BANK_DETAILS and file is PDF, calls `extractDocumentData()` and stores JSON in `extractedData`
- **Uses raw SQL INSERT** because `extractedData` column was added in migration (stale client pattern)

### `PATCH /api/documents/[id]`
- Auth: ADMIN, HR
- Body: `{ approvalStatus: "APPROVED"|"REJECTED", approvalNotes? }`

### `DELETE /api/documents/[id]`
- Auth: ADMIN, HR
- Deletes physical file (best-effort) then DB record

---

### `GET /api/emails`
- Auth: ADMIN, HR
- Returns emails sent by current user. **Uses raw SQL JOIN** to attach MRF data (Prisma client doesn't know `mrf` relation on Email):
```typescript
const emails = await prisma.$queryRawUnsafe<any[]>(
  `SELECT e.*, m.id as mrf_id, m.mrfNumber, m.title as mrf_title
   FROM Email e LEFT JOIN MRF m ON m.id = e.mrfId
   WHERE e.fromId = ? ORDER BY e.sentAt DESC`, userId
);
```

### `POST /api/emails`
- Auth: ADMIN, HR
- Body: `{ toEmail, subject, body, candidateId?, mrfId? }`
- Sends via Gmail SMTP if `SMTP_HOST` set; SMTP failure is non-fatal
- Always records in `Email` table

---

### `GET /api/employees`
- Auth: ADMIN, HR

### `POST /api/employees`
- Auth: ADMIN, HR
- Body: `{ candidateId, joiningDate, department?, designation?, ctc?, reportingTo?, branchId? }`
- Generates employeeCode: `EMP-{count+1 padded to 4}`

### `PATCH /api/employees/[id]`
- Auth: any session (EMPLOYEE can only update own `onboardingStep`)

### `GET /api/employees/me`
- Auth: any session
- Returns: `{ employee, documents }` for current user
- Documents include: `id, name, fileUrl, fileType, fileSize, documentType, approvalStatus, extractedData, createdAt`
- `documentType` is **critical** — employee portal checklist filters by it

---

### `GET /api/mrfs`
- Auth: any session
- Returns: all MRFs with full relations + `_count.candidates`

### `POST /api/mrfs`
- Auth: ADMIN, HR, BRANCH_MANAGER, **COUNTRY_MANAGER**
- Required: `title`, `countryId`, `departmentId`, `ctcRange`, `fillerName`, `fillerDesignation`
- MRF number: sequential per year, `MRF-YYYY-NNNN`, based on last MRF with matching year prefix
- Status always starts as `PENDING_DIVISIONAL`
- After create: notifies all DIVISIONAL_MANAGER users via Notification

### `GET /api/mrfs/[id]`
- Returns full MRF with all relations, approvalRecords (ordered by recordedAt desc)

### `PATCH /api/mrfs/[id]`
- Auth: ADMIN, HR

### `POST /api/mrfs/[id]/approve`
- Auth: ADMIN, HR, DIVISIONAL_MANAGER, FUNCTIONAL_HEAD, COUNTRY_MANAGER
- Body: `{ action: "approve"|"reject", approverName?, approverDesignation?, notes? }`
- Role → Pending status map:
  - DIVISIONAL_MANAGER → PENDING_DIVISIONAL
  - FUNCTIONAL_HEAD → PENDING_FUNCTIONAL
  - COUNTRY_MANAGER → PENDING_COUNTRY
- ADMIN/HR can act at any level
- COUNTRY_MANAGER is "universal" — can act at any pending level
- Approve: creates MRFApprovalRecord, advances status. Final approval sets `approvedAt`.
- Reject: creates record, sets REJECTED, `rejectedAt`, `rejectionReason`
- All DB changes before notification (notifications are non-fatal try/catch)

### `POST /api/mrfs/[id]/send-approval-email`
- Auth: any logged-in manager role
- Body: `{ toEmail, message? }`
- Fetches MRF details via raw SQL JOIN
- Builds formatted email body with MRF details + direct link `${NEXTAUTH_URL}/dashboard/mrfs/${id}`
- Sends via Gmail SMTP; records in Email table via raw SQL INSERT

### `POST /api/mrfs/[id]/restart`
- Auth: ADMIN, HR only
- Requires MRF status === "REJECTED"
- Deletes all MRFApprovalRecord rows for this MRF
- Resets: status → PENDING_DIVISIONAL, rejectedAt → NULL, rejectionReason → NULL, approvedAt → NULL

---

### Org Routes
- `GET/POST /api/org/countries` — GET: full hierarchy (divisions→states→branches + top-level branches)
- `GET/POST /api/org/divisions` — GET: `?countryId`
- `GET/POST /api/org/states` — GET: `?divisionId`
- `GET/POST /api/org/branches` — GET: `?countryId` or `?divisionId` (divisionId → gets all branches in all states of that division)
- `DELETE /api/org/branches/[id]` — ADMIN only; 409 if users or MRFs reference it
- `GET/POST /api/org/departments`
- `GET/POST /api/org/designations`

**Security gap:** POST to divisions and states have no auth check. POST to seed routes have no auth.

---

## 9. Page-by-Page UI Documentation

### `/login`
- Centered card on gray-50 background
- 6 quick-login colored buttons (demo accounts)
- Email + password form
- Calls `signIn("credentials", { email, password })`

### `/dashboard` (role-adaptive)
- **ADMIN/HR:** 4 stat cards, stage pipeline table with progress bars, recent MRFs table
- **CANDIDATE:** Welcome banner, 15-step pipeline tracker (completed=green ✓, current=blue, pending=gray), employee banner if converted
- **EMPLOYEE:** Redirects to `/dashboard/employee-portal`
- **Managers:** Stat cards + recent MRFs

### `/dashboard/mrfs` (MRF List)
- Status summary cards (6 statuses with counts)
- Search bar (client-side: title, MRF number, dept, branch)
- Full-width table
- Role-specific pending banner for managers

### `/dashboard/mrfs/new` (Create MRF)
Form sections:
1. **MRF Reference** — title (required)
2. **Section 1 – Location** — Country → if India: Division → Branch; if Overseas/Corporate: direct Branch
3. **Section 2 – Vacancy Type** — Replacement (replaced employee fields) | New Position (new role / business expansion checkboxes)
4. **Section 3 – Position Details** — Budgeted radio, Dept*, Designation, Grade, CTC Range*, Location, Reporting To, Job Profile, Vacancy Count*
5. **Section 4 – Candidate Specifications** — age range, qualifications, experience, industry, other specs
6. **Section 5 – Certification** — checkbox: "contribution justifies additional cost"
7. **Raised By** — Full Name*, Designation*

**After successful create:** Shows "Send MRF for Approval" dialog:
- Success banner with MRF number
- Approver Email input (required)
- Message textarea (optional)
- "Skip, view MRF" button (goes to MRF detail directly)
- "Send Email" button → calls `/api/mrfs/[id]/send-approval-email` → redirects to MRF detail

### `/dashboard/mrfs/[id]` (MRF Detail)
- Header: MRF title + status badge + action buttons
- **APPROVED MRFs:** "Print / PDF" button → `window.print()` (candidates table + approval history hidden with `print:hidden`)
- **REJECTED MRFs (ADMIN/HR):** "Edit" button (links to `/dashboard/mrfs/[id]/edit`) + "Restart Approval" button (shows confirmation dialog → calls `/api/mrfs/[id]/restart`)
- **Pending MRFs:** "Reject" + "Record Approval"/"Approve" buttons → approval dialog
- Left card: MRF details table
- Right card: 3-step approval timeline (Divisional → Functional → Country) with status icons + "Send Email to Approver" button for ADMIN/HR
- **After approval (non-final):** "Notify [Next Level]" modal appears:
  - Blue info box: "MRF has been approved at this level, awaiting [next]"
  - Next approver email input
  - Optional message textarea
  - "Skip" button | "Send Email" button → calls send-approval-email
- Candidates table (if any)

### `/dashboard/candidates`
- View toggle: List / Daily / Weekly / Monthly
- 15 stage pipeline cards (horizontal scroll)
- Status filter tabs (ALL, ACTIVE, REJECTED, ON_HOLD)
- Search + stage filter
- Candidate rows: Name, Email, MRF position, Stage badge + Status badge, AI Score (green≥70%, orange<70%), date, View link
- **Add Candidate dialog with email autocomplete:**
  - Fetches `/api/users` on mount
  - As user types in Email field, shows dropdown of matching user emails (up to 6)
  - Clicking suggestion fills email + firstName + lastName
  - `autoComplete="off"` on input; blur hides suggestions after 150ms delay

### `/dashboard/candidates/[id]`
- Overview card (candidate info) + Pipeline card (15 stages)
- Stage History table
- Documents section with upload + approval actions
- Status buttons: Mark Rejected / On Hold / Restore Active

### `/dashboard/candidates/[id]/documents` (ADMIN/HR)
- Full Document Center for a specific candidate
- 3-card summary: name/email, current stage, document progress bar
- Upload bar: document type selector + search filter
- Documents grouped into 6 categories (Identity, Resume, Education, Employment, Bank, Other)
- Per-document actions: Download, Replace (with versioning), Approve, Reject
- Expandable extracted data section per document
- "Generate Candidate Package" button → `/dashboard/candidates/[id]/package`
- Uses: `GET /api/candidates/[id]` for initial load, `POST /api/documents` for upload, `PATCH /api/documents/[id]` for approval

### `/dashboard/candidates/[id]/package` (ADMIN/HR)
- Print-optimized candidate package for audit/review
- 6 sections: Candidate Info, Recruitment Timeline, MRF Details, MRF Approval History, Document Index, HR Summary
- "Print / Save as PDF" button → `window.print()`
- CSS `@media print` + `@page { size: A4 }` for clean PDF output
- Uses: `GET /api/candidates/[id]` (extended to include MRF country, division, createdBy, approvalRecords)

### `/dashboard/employees`
- Employee table with structured view dialog
- View dialog sections:
  1. Personal / Contact / Banking info
  2. Family Information (hasChildren, hasSpouse, spouseDateOfBirth)
  3. Compliance Declarations (4 yes/no questions, amber border, Yes=red-700, No=green-700, detail fields indented)
  4. Education table
  5. Employment table
  6. Documents with inline `extractedData` display

### `/dashboard/employee-portal` (3-step onboarding — EMPLOYEE only)

**Step 0 — Upload Documents:**
- Shows document checklist based on `employee.employeeType`:
  - **INDIA checklist:** AADHAAR, PAN, QUALIFICATION_DOCS, BANK_DETAILS, ESIC_CARD (optional), OTHERS (optional)
  - **OVERSEAS checklist:** PASSPORT, QUALIFICATION_DOCS, BANK_DETAILS, OTHERS (optional)
- Each checklist item shows uploaded files beneath it with extracted data from PDFs
- Uploaded files show: filename, timestamp, status badge, extracted fields (blue box)
- Checkbox marks green when documentType matches uploaded doc
- "Continue" button enabled only after ≥1 doc uploaded → PATCH onboardingStep to 1

**Step 1 — Employee Information Form:**
Large multi-section form (saves to `EmployeeOnboardingData.formData` as JSON):
- Personal: firstName, lastName, dob, placeOfBirth, gender, nationality, religion (dropdown), maritalStatus
- Blood Group dropdown: A+/A-/B+/B-/AB+/AB-/O+/O-
- Aadhaar number (INDIA only, required), PAN (INDIA only, required), Passport (OVERSEAS only, required), ESIC Number (optional)
- Present address: street, city, state, pincode, mobile (required), email (required), duration
- Permanent address
- Emergency contact: name, relation, phone (all optional)
- Family Information section:
  - `hasChildren`: Yes/No radio
  - `hasSpouse`: Yes/No radio
  - If hasSpouse = Yes → `spouseDateOfBirth` date input
- Date of Joining (required)
- Education table (6 rows): exam, subject, institute, university, year, percentage
- Employment history table (5 rows): employer, role, from, to, reason
- Banking: account number, bank name, IFSC, branch
- Father's name (optional)
- Compliance Declarations (4 questions, all required as radio):
  1. "Have you ever been convicted of any criminal offence?"
  2. "Have you ever received treatment for drug or alcohol abuse?"
  3. "Do you have any pre-existing medical conditions or physical disabilities?"
  4. "Do you have any physical defect that may affect job performance?"
  - Each: Yes/No radio + conditional detail textarea if Yes
- "Submit" button → POST to API → advances onboardingStep to 2

**Step 2 — Dashboard:**
- Employee details grid
- Post-join pipeline tracker (stages 11–15: Onboarding → Confirmation Letter)
- Uploaded documents list

### `/dashboard/email`
- 3-column layout: email list | email detail
- Compose dialog:
  - **MRF selector** (not candidate): type-ahead search by MRF number or title, shows only pending-approval MRFs
  - Selecting MRF auto-fills subject: "Re: MRF {number} — {title}"
  - toEmail, subject, body fields
- Email detail shows MRF as clickable link with ClipboardList icon
- Sends via `/api/emails` which uses Gmail SMTP

### `/dashboard/documents`
- Pending review count badge
- Filter tabs: ALL / PENDING / APPROVED / REJECTED
- Document type summary row
- Table with: filename (link), type badge, linked entity, uploaded by, size, date, status badge, approve/reject actions
- Shows `extractedData` as inline blue box when present

---

## 10. Business Logic (complete rules)

### MRF Number Generation
```typescript
const prefix = `MRF-${year}-`;
const lastMrf = await prisma.mRF.findFirst({
  where: { mrfNumber: { startsWith: prefix } },
  orderBy: { mrfNumber: "desc" },
});
let seq = lastMrf ? parseInt(lastMrf.mrfNumber.slice(prefix.length), 10) + 1 : 1;
return `${prefix}${seq.toString().padStart(4, "0")}`;
```

### MRF Approval Flow
```
PENDING_DIVISIONAL → (Divisional Manager approves) → PENDING_FUNCTIONAL
PENDING_FUNCTIONAL → (Functional Head approves) → PENDING_COUNTRY
PENDING_COUNTRY   → (Country Manager approves)  → APPROVED
Any stage → (any approver rejects) → REJECTED
```
- ADMIN/HR can act at any level
- COUNTRY_MANAGER is "universal" — can act at any pending level
- Each approval creates an MRFApprovalRecord
- **Chained email:** After approval at each non-final level, UI shows "Send to Next Approver" modal to manually email the next approver with a direct MRF link
- **Rejected recovery:** ADMIN/HR can edit the MRF, then "Restart Approval" which clears all records and resets to PENDING_DIVISIONAL

### Employee Type → Document Rules
- **INDIA employees:** Required: AADHAAR, PAN, QUALIFICATION_DOCS, BANK_DETAILS. Optional: ESIC_CARD, OTHERS
- **OVERSEAS employees:** Required: PASSPORT, QUALIFICATION_DOCS, BANK_DETAILS. Optional: OTHERS
- `employeeType` stored on `Employee` model, set when HR creates the employee record

### Document Extraction (PDFs only)
```typescript
// src/lib/extract-document.ts
const PATTERNS = {
  AADHAAR: { aadhaarNumber: /\b\d{4}\s\d{4}\s\d{4}\b/, name: /.../, dob: /.../ },
  PAN: { panNumber: /\b[A-Z]{5}\d{4}[A-Z]\b/, name: /.../ },
  PASSPORT: { passportNumber: /\b[A-Z]\d{7}\b/, name: /.../, ... },
  BANK_DETAILS: { accountNumber: /.../, ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/, bankName: /.../ },
};
```
Uses `pdf-parse` with dynamic import pattern:
```typescript
const pdfModule = await import("pdf-parse" as any);
const pdfParse = pdfModule.default || pdfModule;
```
Result stored as JSON in `Document.extractedData`.

### Candidate Stage Rules
- 15 stages in fixed order: APPLIED → ... → CONFIRMATION_LETTER
- Forward-only (can't move backwards)
- PSYCHOMETRIC_TEST: checked against `designation.requiresPsychometric`
- Stage filter INTERVIEW_1/2/3: candidates auto-grouped by `interviewDate`
- Candidate created by HR: User account auto-created with random temp password (`Math.random()` — not crypto-secure)

### Employee Code Generation
```typescript
const count = await prisma.employee.count();
const employeeCode = `EMP-${(count + 1).toString().padStart(4, "0")}`;
```
**Risk:** If employees are deleted, count decreases and collisions can occur.

### SMTP Email Pattern (all routes)
```typescript
if (process.env.SMTP_HOST) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({ from: process.env.SMTP_FROM, to: toEmail, subject, text: body });
  } catch { /* non-fatal */ }
}
```

---

## 11. Key Technical Gotchas

### Stale Prisma Client After Migration
After every `npx prisma migrate dev`, run `npx prisma generate`. If you forget, TypeScript will error on new fields. Workaround: `prisma.$queryRawUnsafe()`. This is used extensively for `extractedData`, `documentType`, `fillerName`, `approverRole`, `mrfId` on Email, etc.

### Notification Table — `type` is NOT NULL
```sql
INSERT INTO Notification (id, userId, type, title, message, link, isRead, createdAt)
VALUES (?, ?, 'MRF_APPROVAL', ?, ?, ?, 0, ?)
```
Always provide all 8 columns. Missing `type` → SQLite constraint → 500 → frontend JSON.parse crash.

### Email Table — `mrf` Relation Not in Prisma Schema
The `Email` model has `mrfId String?` column but no Prisma relation defined. Always use raw SQL JOIN:
```typescript
await prisma.$queryRawUnsafe<any[]>(
  `SELECT e.*, m.id as mrf_id, m.mrfNumber, m.title as mrf_title
   FROM Email e LEFT JOIN MRF m ON m.id = e.mrfId
   WHERE e.fromId = ? ORDER BY e.sentAt DESC`, userId
);
```

### Document Upload — `extractedData` Needs Raw SQL INSERT
```typescript
await prisma.$queryRawUnsafe<any[]>(
  `INSERT INTO Document (..., extractedData, ...) VALUES (..., ?, ...) RETURNING *`,
  ..., extractedData, ...
);
```

### Employee Portal Checklist Filter
```typescript
const uploaded = documents.filter((d) => d.documentType === item.key);
```
`/api/employees/me` **must** include `documentType` in the select, otherwise all filters return empty and all checkboxes stay unchecked.

### Dynamic Params (Next.js 16)
```typescript
// CORRECT
const { id } = await params;

// WRONG (pre-Next.js 16 style)
const { id } = params;
```

---

## 12. Seed Data Summary

Call in order:
1. `POST /api/seed` — creates demo users, all departments, designations, countries, initial org structure
2. `POST /api/seed/extend-org` — adds more states and branches to South West and East Central divisions
3. `POST /api/seed/fix-org` (as ADMIN) — fixes Bhubaneswar code, adds lab branches, creates demo employee user

**Post-seed org structure:**
- **India → South West Division:** Gujarat (Gandhidham), Maharashtra (Mumbai), Rajasthan (Udaipur), Tamil Nadu (Chennai), Karnataka (Hospet), Goa (Goa)
- **India → East Central Division:** West Bengal (Kolkata), Odisha (Bhubaneswar, Barbil, West Orissa), AP (Vizag), Assam (Guwahati), MP (Katni), Chhattisgarh (Raipur Lab)
- **Corporate:** Kolkata HO, Delhi HO, Central Lab, Udayayan Lab
- **Overseas:** Australia, UAE, Oman, South Africa, Japan, Indonesia

**Departments:** Operations, Finance, HR, Engineering, IT, Procurement, Safety, Marketing

**Designations:** Manager (psychometric required), Senior Engineer (required), Engineer, Analyst, HR Executive, IT Specialist, Procurement Officer, Safety Officer (required)

---

## 13. Sprint History (what was built, in order)

### Original Build (pre-sprint)
- Core recruitment pipeline, candidate management, document uploads, employee portal (basic), email (candidate-linked), org management, user management, reports

### Sprint 1 Changes
1. **Email autocomplete** in Add Candidate dialog — fetches `/api/users`, shows suggestions filtered by typed email, auto-fills name fields
2. **COUNTRY_MANAGER can create MRFs** — added to allowed roles in API + canCreate check on page
3. **"Others" document type** — added to both INDIA and OVERSEAS checklists in employee portal
4. **Employee form expansion:**
   - `dateOfJoining` (mandatory), `esicNumber` (optional)
   - `religion` → dropdown (Hindu/Muslim/Christian/Sikh/Buddhist/Jain/Other)
   - `bloodGroup` → dropdown (A+/A-/B+/B-/AB+/AB-/O+/O-)
   - Family info: `hasChildren`, `hasSpouse`, conditional `spouseDateOfBirth`
   - 4 compliance declaration yes/no radio questions with conditional detail textareas
   - Removed: father's name required, present address street required
   - Added required: `presentMobile`, `presentEmail`
5. **Employee type system** (INDIA vs OVERSEAS) → conditional document checklist + identity field rules
6. **Extracted data display** — shown inline under uploaded docs in employee portal and document management page
7. **Email system overhaul** — replaced candidate selector with MRF selector (pending MRFs only), email detail shows MRF link, removed candidate linking from compose
8. **HR/Admin employee profile view** — structured sections: personal, family, compliance declarations (color-coded), education, employment, documents with extracted data
9. **Document templates** — HR/Admin can upload templates; employees can download them

### Sprint 2 Changes
1. **Critical bug fix** — MRF approval/rejection was crashing with JSON.parse error. Root cause: `createNotification` INSERT missing `type` column (NOT NULL constraint → SQLite error → 500 HTML → frontend JSON.parse failure). Fixed + wrapped notification block in try/catch.
2. **Employee document visibility fix** — `/api/employees/me` select was missing `documentType` and `approvalStatus`, so employee portal checklist couldn't match uploaded docs. Fixed by adding all required fields.
3. **MRF approval email workflow:**
   - New API: `POST /api/mrfs/[id]/send-approval-email` — sends formatted email + records in Email table
   - MRF create page: shows "Send for Approval" modal after successful create
   - MRF detail page: shows "Send to Next Approver" modal after each non-final approval
4. **Print/PDF for approved MRFs** — "Print / PDF" button on approved MRF detail (`window.print()`; candidates + approval history hidden with `print:hidden`)
5. **Rejected MRF recovery** (ADMIN/HR):
   - New API: `POST /api/mrfs/[id]/restart` — clears approval records, resets to PENDING_DIVISIONAL
   - MRF detail shows "Edit" + "Restart Approval" buttons on rejected MRFs
6. **Notification fix in approve route** — entire notification+email block now wrapped in try/catch so DB changes commit even if SMTP/notification fails

### Sprint 3 Changes (Phase 1–5 implementation)

#### Phase 1 — Analysis (no code changes)
- **Vercel deployment blockers:** SQLite (file-based), local file writes (`public/uploads/`), pdf-parse native bindings, nodemailer Edge runtime incompatibility. Fix path: Turso (remote libsql) + Vercel Blob storage.
- **Gmail SMTP decision:** Kept Gmail SMTP with App Password (`kgwfynbsyaohvprc`) for current scale. Recommendation for production: switch to Resend API.

#### Phase 2 — Employee Document Parsing
- **Migration added** (`20260617164852_add_document_versioning_categories`): New columns on `Document`:
  - `version INT NOT NULL DEFAULT 1` — document version counter
  - `replacesDocumentId TEXT` — links replacement to previous version
  - `parseStatus TEXT NOT NULL DEFAULT 'PENDING'` — tracks HR parse review state (PENDING / REVIEWED / APPLIED)
  - `category TEXT` — auto-categorized from documentType (Identity / Resume / Education / Employment / Bank / Other)
- **New indexes:** Document(candidateId), Document(documentType), Document(approvalStatus), MRFApprovalRecord(mrfId), Candidate(currentStage), Candidate(userId)
- **`/lib/extract-document.ts`** (pre-existing): Handles PDF text extraction via `pdf-parse` dynamic import. Pattern: `const pdfModule = await import("pdf-parse" as any); const pdfParse = pdfModule.default || pdfModule;`
- **New API: `POST /api/documents/[id]/apply-to-profile`** — Merges `document.extractedData` fields into candidate's employee `EmployeeOnboardingData.formData`. Auth: ADMIN/HR. Fails gracefully if no employee record or no extracted data.
- **Documents page (`/dashboard/documents`):**
  - Added "Apply to Profile" button in the extracted data box (only shown when candidate has an Employee record)
  - Added `Sparkles` icon import
  - `candidate` interface extended: `employee: { id: string } | null`
  - `applyResult` state tracks per-document success/error message
  - Documents API fixed: `candidate` select now includes `id` and `employee.id` (was missing `id`, breaking grouping)

#### Phase 3 — Candidate Document Center
- **New page: `/dashboard/candidates/[id]/documents/page.tsx`** — Full candidate document management hub for ADMIN/HR
  - 6 document categories: Identity (ID_PROOF, AADHAAR, PAN), Resume (RESUME), Education (EDUCATION), Employment (EXPERIENCE_LETTER, EMPLOYMENT_LETTER), Bank (BANK), Other (APPOINTMENT_LETTER, OFFER_LETTER, AGREEMENT, OTHER)
  - Features: candidate summary cards (name, stage, doc progress), upload bar with type selector, per-document: filename, size, date, uploader, version badge (v≥2), approval status badge, expandable extracted data, Download/Replace/Approve/Reject actions
  - Replace dialog: uploads new file with `replacesDocumentId` in FormData
  - "Generate Candidate Package" button links to `/dashboard/candidates/[id]/package`
- **New page: `/dashboard/candidates/[id]/package/page.tsx`** — Printable candidate package for audits
  - 6 sections: Candidate Information, Recruitment Timeline (stage history), MRF Details, MRF Approval History, Document Index, HR Summary
  - `window.print()` button + `@media print` styles for clean PDF output
  - AI Score color-coded (green ≥70%, orange <70%)
- **`/api/candidates/[id]` (GET) extended:**
  - `mrf` include now adds: `country`, `division`, `createdBy`, `approvalRecords` (ordered by recordedAt asc)
  - `stageHistory` now ordered asc (was desc) for proper timeline rendering

#### Phase 4 — Employee Onboarding Forms
- **5 statutory PDFs** added to `public/forms/`:
  - `/forms/Form_A.pdf` — PF Membership Declaration
  - `/forms/Form_B.pdf` — PF Nomination Form
  - `/forms/Form1.pdf` — ESIC Declaration
  - `/forms/Form_11.pdf` — EPF Composite Declaration
  - `/forms/Application_Form_Permanent.pdf` — Pre-employment application
- **Employee Portal `/dashboard/employee-portal`** updated:
  - Added "Statutory Joining Forms" card with hardcoded links to all 5 static PDFs (always visible)
  - Existing "Additional HR Templates" card retained (only shown if DB templates exist)
- **New API: `GET+POST /api/employees/[id]/onboarding-data`**
  - GET: returns `EmployeeOnboardingData` with `formData` parsed from JSON string
  - POST: upserts `EmployeeOnboardingData.formData` (merges with or replaces existing)
  - Auth: EMPLOYEE (own only) or ADMIN/HR
  - Employee ownership check: `employee.candidate.userId === session.user.id`

#### Phase 5 — Architecture Decisions Recorded
- SQLite + local filesystem = incompatible with Vercel/serverless. Requires Turso + Vercel Blob for production.
- Document versioning schema in place for future full version history UI.
- No AI integration implemented — `aiScore`/`aiScoreNotes` on Candidate are manually set by HR.

#### Sidebar Update
- "Documents" nav item → renamed to "Document Center" with sub-items:
  - "All Documents" → `/dashboard/documents`
  - "Candidate Docs" → `/dashboard/candidates`
- `FolderOpen` icon used for Document Center parent item

---

## 14. Recommended Reconstruction Order

```bash
# 1. Scaffold
npx create-next-app@16.2.7 recruitpro-erp --typescript --tailwind --app --src-dir --import-alias "@/*"

# 2. Install dependencies (exact list from Section 2)
npm install next-auth@^4.24.14 @auth/prisma-adapter prisma @prisma/client @prisma/adapter-libsql @libsql/client bcryptjs nodemailer
npm install lucide-react clsx tailwind-merge class-variance-authority date-fns
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-tabs @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-slot @radix-ui/react-toast
npm install -D @types/bcryptjs @types/nodemailer dotenv

# 3. Create .env (Section 5)

# 4. Create prisma/schema.prisma (Section 4)
npx prisma migrate dev --name init
npx prisma generate

# 5. Create src/lib/{auth.ts, prisma.ts, utils.ts, extract-document.ts}
# 6. Create all shadcn/ui components in src/components/ui/
# 7. Create layout components (sidebar, topbar, providers)
# 8. Create all API routes (Section 8)
# 9. Create all dashboard pages (Section 9)
# 10. Seed: POST /api/seed → POST /api/seed/extend-org → POST /api/seed/fix-org
```

---

## 15. Known Issues and Limitations

| Issue | Impact | Notes |
|---|---|---|
| `Employee.department` and `.designation` are free-text strings | No validation against Dept/Designation models | By design — HR manually types them |
| Employee code uses `count() + 1` | Collisions if employees deleted | Known debt |
| `generateMRFNumber()` in utils.ts uses Math.random() | Legacy, never called | Sequential version is in the API route |
| `POST /api/org/divisions` has no auth | Anyone can create divisions | Security gap |
| `POST /api/seed` has no auth | Anyone can re-seed | Idempotent but still a gap |
| Files in `public/uploads/` are publicly accessible | No auth on uploaded files | By design for simplicity |
| InterviewRecord and OfferDetail models exist but no UI | Schema only | Future feature |
| UserCountryAssignment model exists but no management UI | Schema only | Future feature |
| No pagination on any list endpoint | Could be slow at scale | Known limitation |
| CANDIDATE temp password uses Math.random() | Not cryptographically secure | Not emailed to candidate; HR communicates manually |
| `topbar.tsx` pageTitles has stale `/dashboard/my-application` entry | Dead code, no error | Cleanup item |
| `Employee.department` and `.designation` are free-text strings, not FKs | Cannot query dept head or designation budget from employee | Schema gap — see Section 16 |
| `Document` has no `employeeId` | Post-hire documents forced onto `candidateId` — semantically wrong | Schema gap — see Section 16 |
| `Employee` has no direct `mrfId` | MRF reference is indirect via candidate | Schema gap — see Section 16 |
| `EmployeeOnboardingData.formData` is a JSON text blob | PII fields (Aadhaar, PAN, bank) not individually queryable | Schema gap — see Section 16 |
| No `AuditLog` model | No unified who-changed-what-when across the system | Major gap — see Section 16 |
| No `/dashboard/employees/[id]` page | HR cannot view a single employee dossier | Missing page — see Section 16 |

---

## 16. Unified Employee Dossier — Gap Analysis + Implementation Plan

### Current lifecycle support

The chain **MRF → Candidate → Employee → Onboarding** is partially supported but has 7 critical gaps blocking a true digital personnel file.

### What already works

| Requirement | Status |
|---|---|
| MRF → Candidate link (`Candidate.mrfId`) | ✓ |
| Candidate → Employee link (`Employee.candidateId`) | ✓ |
| Stage history (`CandidateStageHistory`) | ✓ |
| Documents linked to candidate | ✓ |
| Documents linked to MRF | ✓ |
| MRF approval chain (`MRFApprovalRecord`) | ✓ |
| Employee onboarding form data (`EmployeeOnboardingData`) | ✓ |
| Employee → Branch FK | ✓ |

### Critical gaps (blockers)

**Gap 1 — No direct Employee → MRF link**
`Employee` has no `mrfId`. To get the MRF you must traverse: `Employee → Candidate.mrfId → MRF`. If `candidate.mrfId` changes, the historical "hired against this MRF" reference is lost. The employee should permanently retain the original hiring MRF.

**Gap 2 — Documents cannot be linked to Employee**
`Document` has `candidateId` and `mrfId` but no `employeeId`. Post-hire documents (appointment letter, joining forms signed, promotion letters) are incorrectly forced onto `candidateId` — semantically wrong.

**Gap 3 — `Employee.department` / `Employee.designation` are free-text strings**
No FK to `Department` or `Designation`. Cannot query department head, budget range, or psychometric requirement from an employee record. Breaks meaningful reporting.

**Gap 4 — `EmployeeOnboardingData.formData` is a JSON text blob**
All fields (Aadhaar, PAN, bank account, blood group, address) are buried in a serialized text string. Cannot query by field, run compliance reports, or audit PII completeness.

**Gap 5 — No `AuditLog` model**
There is no unified change history. Upload history = `createdAt`/`uploadedById` only. No modification log, no deletion log, no "who changed salary on 2026-03-01" record.

**Gap 6 — `InterviewRecord` and `OfferDetail` exist in schema but have zero UI or API**
Both models are in `schema.prisma`. No API route reads or writes them. Interview history and offer details are invisible in the system.

**Gap 7 — No Employee profile page for HR/Admin**
`/dashboard/employees` is a list only. There is no `/dashboard/employees/[id]` dossier page and no `/dashboard/employees/[id]/report` page.

### Required schema changes (migration)

```prisma
// 1. Employee — direct MRF reference + proper FKs
model Employee {
  mrfId         String?   // direct reference to hiring MRF
  departmentId  String?   // FK replaces free-text department
  designationId String?   // FK replaces free-text designation

  mrf   MRF?         @relation(fields: [mrfId], references: [id])
  dept  Department?  @relation(fields: [departmentId], references: [id])
  desig Designation? @relation(fields: [designationId], references: [id])
}

// 2. Document — add employeeId for post-hire docs
model Document {
  employeeId  String?
  employee    Employee? @relation(fields: [employeeId], references: [id])
}

// 3. EmployeeOnboardingData — structured critical fields
model EmployeeOnboardingData {
  // keep formData JSON for full form storage
  aadhaarNumber  String?   // indexed critical PII
  panNumber      String?
  passportNumber String?
  bankAccount    String?
  bankName       String?
  ifscCode       String?
  bloodGroup     String?
}

// 4. AuditLog — unified change history
model AuditLog {
  id            String   @id @default(cuid())
  entityType    String   // EMPLOYEE | CANDIDATE | DOCUMENT | MRF | USER
  entityId      String
  action        String   // CREATE | UPDATE | DELETE | APPROVE | REJECT | UPLOAD | STAGE_CHANGE
  fieldName     String?
  oldValue      String?
  newValue      String?
  performedById String
  performedAt   DateTime @default(now())
  metadata      String?  // JSON for extra context

  performedBy User @relation(fields: [performedById], references: [id])

  @@index([entityType, entityId])
  @@index([performedAt])
}
```

### Required API changes

| Endpoint | Change | Purpose |
|---|---|---|
| `GET /api/employees/[id]/dossier` | NEW | Full dossier: employee + candidate + MRF + documents by category + stage history + interviews + onboarding data + audit log |
| `GET /api/employees/[id]/report` | NEW | Structured JSON for PDF report generation |
| `POST /api/employees` | CHANGE | On create: copy `candidate.mrfId` → `employee.mrfId`; copy MRF's `departmentId`/`designationId` → employee |
| `GET/POST /api/interviews` | NEW | Create and list interview records (currently unused model) |
| `GET/PATCH /api/offers/[candidateId]` | NEW | Manage offer details (currently unused model) |
| `GET /api/documents` | CHANGE | Support `?employeeId=` filter |
| `POST /api/documents` | CHANGE | Accept `employeeId` in FormData |
| All write APIs | CHANGE | Write to `AuditLog` after every state change |

### Required frontend changes

| Page | Type | Description |
|---|---|---|
| `/dashboard/employees/[id]` | NEW | Employee Dossier — 4 tabs: Details, Recruitment, Documents, Audit Trail |
| `/dashboard/employees/[id]/report` | NEW | Printable Employee Master Report — all data, `window.print()` |
| `/dashboard/employees` | CHANGE | Employee rows link to `/dashboard/employees/[id]` |
| Add Employee dialog | CHANGE | On create: set `mrfId`, `departmentId`, `designationId` |

### Document category expansion needed

Current `documentType` values cover 8 types. The dossier requires 20+:

```
PRE-HIRE:     RESUME, COVER_LETTER, PORTFOLIO
IDENTITY:     AADHAAR, PAN, PASSPORT, ID_PROOF, ADDRESS_PROOF
EDUCATION:    DEGREE, MARKSHEET, CERTIFICATION
EMPLOYMENT:   EXPERIENCE_LETTER, RELIEVING_LETTER
JOINING:      FORM_A, FORM_B, FORM_1, FORM_11, APPOINTMENT_LETTER
INTERNAL HR:  OFFER_LETTER, PROMOTION_LETTER, AGREEMENT
GENERATED:    GENERATED_MRF, GENERATED_CANDIDATE_PACKAGE, GENERATED_EMPLOYEE_PACKAGE
OTHER:        OTHER, ONBOARDING
```

These can be expanded as application constants — no migration required for the type values themselves since `documentType` is a free-text column.

### Migration SQL to add to V2 right now

Run as a new Prisma migration (`npx prisma migrate dev --name employee_dossier`):

```sql
-- Employee: direct MRF + proper department/designation FKs
ALTER TABLE "Employee" ADD COLUMN "mrfId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "designationId" TEXT;

-- Document: can now link to an employee directly (post-hire docs)
ALTER TABLE "Document" ADD COLUMN "employeeId" TEXT;

-- EmployeeOnboardingData: structured PII fields alongside JSON blob
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "aadhaarNumber" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "panNumber" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "passportNumber" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "bankName" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "ifscCode" TEXT;
ALTER TABLE "EmployeeOnboardingData" ADD COLUMN "bloodGroup" TEXT;

-- AuditLog: unified change history for all entities
CREATE TABLE "AuditLog" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "entityType"    TEXT NOT NULL,
  "entityId"      TEXT NOT NULL,
  "action"        TEXT NOT NULL,
  "fieldName"     TEXT,
  "oldValue"      TEXT,
  "newValue"      TEXT,
  "performedById" TEXT NOT NULL,
  "performedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata"      TEXT,
  CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_performedAt_idx" ON "AuditLog"("performedAt");
```

### How to populate mrfId on Employee creation

In `POST /api/employees`, after creating the employee record, immediately set `mrfId` from the candidate:

```typescript
// After creating employee:
const candidate = await prisma.candidate.findUnique({
  where: { id: body.candidateId },
  include: { mrf: { select: { departmentId: true, designationId: true } } }
});
await prisma.employee.update({
  where: { id: employee.id },
  data: {
    mrfId: candidate?.mrfId ?? undefined,
    departmentId: candidate?.mrf?.departmentId ?? undefined,
    designationId: candidate?.mrf?.designationId ?? undefined,
  }
});
```

### AuditLog helper (add to `src/lib/audit.ts`)

```typescript
import { prisma } from "./prisma";
import { randomUUID } from "crypto";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "UPLOAD" | "STAGE_CHANGE" | "LOGIN";
type AuditEntity = "EMPLOYEE" | "CANDIDATE" | "DOCUMENT" | "MRF" | "USER";

export async function writeAudit(params: {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  performedById: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}) {
  // Non-fatal — audit failure must never block the main operation
  try {
    await prisma.$queryRawUnsafe(
      `INSERT INTO AuditLog (id, entityType, entityId, action, fieldName, oldValue, newValue, performedById, performedAt, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      params.entityType,
      params.entityId,
      params.action,
      params.fieldName ?? null,
      params.oldValue ?? null,
      params.newValue ?? null,
      params.performedById,
      new Date().toISOString(),
      params.metadata ? JSON.stringify(params.metadata) : null
    );
  } catch { /* non-fatal */ }
}
```

Usage in any API route:
```typescript
await writeAudit({ entityType: "CANDIDATE", entityId: id, action: "STAGE_CHANGE",
  performedById: userId, oldValue: candidate.currentStage, newValue: body.toStage });
```

### Employee Dossier page structure (`/dashboard/employees/[id]`)

Four-tab layout:

**Tab 1 — Details**
- Employee header: employeeCode, name, photo placeholder, status badge
- Grid: joining date, department (linked to Dept model), designation, CTC, reporting to, branch, employeeType
- Onboarding data section: personal (DOB, gender, blood group), contact (present address, mobile, email), bank (account no, bank name, IFSC), identity (Aadhaar last 4, PAN masked, passport)
- Compliance declarations: 4 yes/no fields, colour-coded

**Tab 2 — Recruitment History**
- Candidate summary: application date, AI score, resume link
- Stage timeline: full CandidateStageHistory list with timestamps and notes
- Offer details: offered salary, offered date, accepted date, probation end
- Interview records: interviewer, scheduled at, result, notes
- Linked MRF card: mrfNumber, title, department, vacancies, CTC range, approval status

**Tab 3 — Documents**
Grouped by category (same 8 groups as the Candidate Document Center):
- Pre-Hire, Identity, Education, Employment, Joining Forms, Internal HR, Generated, Other
- Each doc: name, size, date, uploader, version badge, approval badge
- Actions: Download, Replace, Approve/Reject (for HR/Admin)
- Upload bar at top with `employeeId` in FormData

**Tab 4 — Audit Trail**
- Table: Date/time, Action, Entity, Field changed, Old value → New value, Performed by
- Filter by action type and date range
- Reverse chronological order

### Employee Master Report (`/dashboard/employees/[id]/report`)

Print-optimized page with sections:
1. Cover: employee name, code, joining date, current stage, generated timestamp
2. Personal & Contact information
3. Employment details (department, designation, CTC, reporting to, branch)
4. Linked MRF summary
5. MRF approval history table
6. Recruitment timeline (stage history)
7. Interview history table
8. Offer details
9. Document index table (name, type, date, status)
10. Compliance declarations
11. Onboarding status
12. HR summary (document count, days since joining, onboarding step)

`window.print()` button hidden in print view. CSS: `@page { size: A4; margin: 1.5cm }`.

---

## 17. RecruitPro V3 — Complete Builder's Blueprint

### V3 is a ground-up rebuild with the same product goal but none of V2's architectural constraints.

This section is a complete builder's blueprint. Follow it to create a production-grade RecruitPro V3 from scratch.

---

### V3 Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Same as V2 — it works. Stable in v15. |
| Language | TypeScript 5 (strict) | Same |
| Styling | Tailwind CSS v4 + shadcn/ui | Same — good defaults, no rebuild needed |
| Database | **PostgreSQL on Neon** | Serverless-compatible, concurrent writes, native JSON, full-text search, works on Vercel |
| ORM | **Prisma 6 + @prisma/adapter-neon** | Same ORM, different adapter |
| Auth | **NextAuth v5 (Auth.js)** | Native App Router support, typed sessions, drop-in from v4 |
| File Storage | **AWS S3 or Vercel Blob** | Never local disk. Signed URLs for auth on every download |
| Email | **Resend + react-email** | Reliable delivery, React templates, webhooks |
| Background Jobs | **Inngest** | Document OCR, report generation, emails leave the request lifecycle |
| API validation | **Zod** | Every route validates input at the boundary |
| Server state | **TanStack Query** | Replaces useEffect+fetch+setState on every client page |
| UI state | **Zustand** | One store for dialogs, filters, selections |
| Permissions | **permissions.ts config** | One file, not 40 API routes with inline role checks |

---

### V3 Complete Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── Organisation ────────────────────────────────────────────────

model Country {
  id           String   @id @default(cuid())
  name         String   @unique
  code         String   @unique
  locationType String   @default("OVERSEAS") // INDIA | OVERSEAS | CORPORATE
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  divisions          Division[]
  branches           Branch[]
  users              User[]
  mrfs               MRF[]
  countryAssignments UserCountryAssignment[]
}

model Division {
  id        String   @id @default(cuid())
  name      String
  countryId String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  country  Country  @relation(fields: [countryId], references: [id])
  states   State[]
  branches Branch[]
  mrfs     MRF[]

  @@unique([name, countryId])
}

model State {
  id         String   @id @default(cuid())
  name       String
  divisionId String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  division Division @relation(fields: [divisionId], references: [id])
  branches Branch[]

  @@unique([name, divisionId])
}

model Branch {
  id         String   @id @default(cuid())
  name       String
  code       String   @unique
  countryId  String
  stateId    String?
  divisionId String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  country   Country   @relation(fields: [countryId], references: [id])
  state     State?    @relation(fields: [stateId], references: [id])
  division  Division? @relation(fields: [divisionId], references: [id])
  users     User[]
  mrfs      MRF[]
  employees Employee[]
}

model Department {
  id        String   @id @default(cuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mrfs                   MRF[]
  functionalHeadMappings DepartmentFunctionalHead[]
  designations           Designation[]
  employees              Employee[]
}

model DepartmentFunctionalHead {
  id           String  @id @default(cuid())
  departmentId String
  userId       String
  countryId    String?
  stateId      String?

  department Department @relation(fields: [departmentId], references: [id])
  user       User       @relation(fields: [userId], references: [id])

  @@unique([departmentId, userId])
}

model Designation {
  id                   String   @id @default(cuid())
  title                String   @unique
  departmentId         String
  requiresPsychometric Boolean  @default(false)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  department Department @relation(fields: [departmentId], references: [id])
  mrfs       MRF[]
  employees  Employee[]
}

// ─── Users & Auth ────────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String   // bcrypt hash, cost 12
  role      String   @default("CANDIDATE")
  branchId  String?
  countryId String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch  Branch?  @relation(fields: [branchId], references: [id])
  country Country? @relation(fields: [countryId], references: [id])

  sessions               Session[]
  accounts               Account[]
  createdMRFs            MRF[]                    @relation("MRFCreator")
  functionalHeadOf       DepartmentFunctionalHead[]
  countryAssignments     UserCountryAssignment[]
  candidateProfile       Candidate?
  mrfApprovalRecords     MRFApprovalRecord[]      @relation("ApproverRecords")
  recordedApprovals      MRFApprovalRecord[]      @relation("RecorderRecords")
  uploadedDocuments      Document[]               @relation("UploadedBy")
  interviews             InterviewRecord[]
  sentEmails             Email[]                  @relation("SentEmails")
  notifications          Notification[]
  uploadedTemplates      DocumentTemplate[]       @relation("TemplateUploadedBy")
  auditLogs              AuditLog[]
}

model UserCountryAssignment {
  id        String @id @default(cuid())
  userId    String
  countryId String

  user    User    @relation(fields: [userId], references: [id])
  country Country @relation(fields: [countryId], references: [id])

  @@unique([userId, countryId])
}

// NextAuth required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── MRF ─────────────────────────────────────────────────────────

model MRF {
  id              String    @id @default(cuid())
  mrfNumber       String    @unique           // MRF-YYYY-NNNN
  title           String
  countryId       String
  divisionId      String?
  branchId        String?
  departmentId    String
  designationId   String?
  vacancyCount    Int       @default(1)
  justification   String?
  fillerName      String?
  fillerDesignation String?
  status          String    @default("PENDING_DIVISIONAL") // PENDING_DIVISIONAL | PENDING_FUNCTIONAL | PENDING_COUNTRY | APPROVED | REJECTED
  createdById     String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  approvedAt      DateTime?
  rejectedAt      DateTime?
  rejectionReason String?
  // Vacancy type fields
  vacancyType                String?  // NEW | REPLACEMENT
  replacedEmployeeName       String?
  replacedEmployeeCTC        String?
  replacementFor             String?
  replacementReason          String?
  replacementNecessityReason String?
  isNewRole                  Boolean  @default(false)
  isBusinessExpansion        Boolean  @default(false)
  newRoleJustification       String?
  isBudgeted                 Boolean?
  // Position details
  proposedGrade              String?
  ctcRange                   String?
  location                   String?
  reportingTo                String?
  jobProfile                 String?
  // Candidate specs
  minAge                     Int?
  maxAge                     Int?
  minQualification           String?
  preferredQualification     String?
  workExperience             String?
  industryBackground         String?
  otherSpecs                 String?
  contributionJustified      Boolean  @default(false)

  country     Country      @relation(fields: [countryId], references: [id])
  division    Division?    @relation(fields: [divisionId], references: [id])
  branch      Branch?      @relation(fields: [branchId], references: [id])
  department  Department   @relation(fields: [departmentId], references: [id])
  designation Designation? @relation(fields: [designationId], references: [id])
  createdBy   User         @relation("MRFCreator", fields: [createdById], references: [id])

  approvalRecords MRFApprovalRecord[]
  candidates      Candidate[]
  documents       Document[]
  emails          Email[]
  employees       Employee[]   // employees hired against this MRF
}

model MRFApprovalRecord {
  id                  String   @id @default(cuid())
  mrfId               String
  level               String   // DIVISIONAL_MANAGER | FUNCTIONAL_HEAD | COUNTRY_MANAGER
  approverRole        String?
  approverId          String?
  approverName        String
  approverDesignation String?
  status              String   @default("PENDING") // PENDING | APPROVED | REJECTED
  notes               String?
  recordedById        String
  recordedAt          DateTime @default(now())
  documentId          String?

  mrf        MRF       @relation(fields: [mrfId], references: [id])
  approver   User?     @relation("ApproverRecords", fields: [approverId], references: [id])
  recordedBy User      @relation("RecorderRecords", fields: [recordedById], references: [id])
  document   Document? @relation(fields: [documentId], references: [id])
}

// ─── Recruitment ─────────────────────────────────────────────────

model Candidate {
  id              String    @id @default(cuid())
  userId          String    @unique
  mrfId           String?
  firstName       String
  lastName        String
  email           String    @unique
  phone           String?
  currentStage    String    @default("APPLIED")
  aiScore         Float?
  aiScoreNotes    String?
  resumeUrl       String?
  isActive        Boolean   @default(true)
  candidateStatus String    @default("ACTIVE") // ACTIVE | REJECTED | ON_HOLD
  statusNote      String?
  interviewDate   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user         User                    @relation(fields: [userId], references: [id])
  mrf          MRF?                    @relation(fields: [mrfId], references: [id])
  stageHistory CandidateStageHistory[]
  interviews   InterviewRecord[]
  documents    Document[]
  offerDetail  OfferDetail?
  employee     Employee?
  emails       Email[]
}

model CandidateStageHistory {
  id          String   @id @default(cuid())
  candidateId String
  fromStage   String?
  toStage     String
  notes       String?
  changedById String?  // V3: track who moved the stage
  changedAt   DateTime @default(now())

  candidate Candidate @relation(fields: [candidateId], references: [id])
}

model InterviewRecord {
  id            String    @id @default(cuid())
  candidateId   String
  interviewerId String
  round         Int       @default(1) // 1 | 2 | 3
  scheduledAt   DateTime
  completedAt   DateTime?
  venue         String?   // ONLINE | OFFICE | PHONE
  result        String?   // PASS | FAIL | HOLD
  notes         String?
  createdAt     DateTime  @default(now())

  candidate   Candidate @relation(fields: [candidateId], references: [id])
  interviewer User      @relation(fields: [interviewerId], references: [id])
}

model OfferDetail {
  id             String    @id @default(cuid())
  candidateId    String    @unique
  offeredSalary  Float?
  offeredAt      DateTime  @default(now())
  acceptedAt     DateTime?
  declinedAt     DateTime?
  declineReason  String?
  probationEndAt DateTime?
  notes          String?

  candidate Candidate @relation(fields: [candidateId], references: [id])
}

// ─── Employee ─────────────────────────────────────────────────────

model Employee {
  id            String   @id @default(cuid())
  candidateId   String   @unique
  mrfId         String?                    // direct reference to hiring MRF
  employeeCode  String   @unique            // EMP-NNNN — use sequence table, not count()
  joiningDate   DateTime
  department    String?                     // human-readable copy (denormalised for display)
  designation   String?                     // human-readable copy
  departmentId  String?                     // FK to Department
  designationId String?                     // FK to Designation
  ctc           Float?
  reportingTo   String?
  branchId      String?
  isActive      Boolean  @default(true)
  onboardingStep Int     @default(0)        // 0=upload docs, 1=fill form, 2=complete
  employeeType  String   @default("INDIA")  // INDIA | OVERSEAS
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  candidate     Candidate               @relation(fields: [candidateId], references: [id])
  mrf           MRF?                    @relation(fields: [mrfId], references: [id])
  branch        Branch?                 @relation(fields: [branchId], references: [id])
  dept          Department?             @relation(fields: [departmentId], references: [id])
  desig         Designation?            @relation(fields: [designationId], references: [id])
  onboardingData EmployeeOnboardingData?
  documents     Document[]              @relation("EmployeeDocuments")
}

model EmployeeOnboardingData {
  id             String   @id @default(cuid())
  employeeId     String   @unique
  // Structured PII fields — queryable, reportable
  aadhaarNumber  String?
  panNumber      String?
  passportNumber String?
  bankAccount    String?
  bankName       String?
  ifscCode       String?
  bloodGroup     String?
  emergencyName  String?
  emergencyPhone String?
  presentAddress String?
  // Full JSON for everything else (education table, employment table, declarations)
  formData       String   // JSON blob for remaining fields
  submittedAt    DateTime @default(now())
  updatedAt      DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])
}

// ─── Documents ───────────────────────────────────────────────────

model Document {
  id              String   @id @default(cuid())
  name            String
  fileUrl         String   // S3 key (NOT a public URL — generate signed URL on download)
  fileType        String
  fileSize        Int
  documentType    String   @default("OTHER")
  uploadedById    String
  candidateId     String?  // pre-hire docs
  mrfId           String?  // MRF-attached docs
  employeeId      String?  // post-hire employee docs
  approvalStatus  String   @default("PENDING") // PENDING | APPROVED | REJECTED
  approvalNotes   String?
  extractedData   String?  // JSON from OCR/pdf-parse (background job)
  parseStatus     String   @default("PENDING") // PENDING | PROCESSING | DONE | FAILED
  version         Int      @default(1)
  replacesDocumentId String?
  category        String?  // PRE_HIRE | IDENTITY | EDUCATION | EMPLOYMENT | JOINING | INTERNAL | GENERATED | OTHER
  createdAt       DateTime @default(now())

  uploadedBy      User               @relation("UploadedBy", fields: [uploadedById], references: [id])
  candidate       Candidate?         @relation(fields: [candidateId], references: [id])
  mrf             MRF?               @relation(fields: [mrfId], references: [id])
  employee        Employee?          @relation("EmployeeDocuments", fields: [employeeId], references: [id])
  approvalRecords MRFApprovalRecord[]

  @@index([candidateId])
  @@index([employeeId])
  @@index([documentType])
  @@index([approvalStatus])
}

// ─── Communications ──────────────────────────────────────────────

model Email {
  id          String   @id @default(cuid())
  fromId      String
  toEmail     String
  subject     String
  body        String
  isRead      Boolean  @default(false)
  sentAt      DateTime @default(now())
  candidateId String?
  mrfId       String?

  from      User       @relation("SentEmails", fields: [fromId], references: [id])
  candidate Candidate? @relation(fields: [candidateId], references: [id])
  mrf       MRF?       @relation(fields: [mrfId], references: [id])  // proper Prisma relation in V3
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  message   String
  link      String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ─── Audit ───────────────────────────────────────────────────────

model AuditLog {
  id            String   @id @default(cuid())
  entityType    String   // EMPLOYEE | CANDIDATE | DOCUMENT | MRF | USER
  entityId      String
  action        String   // CREATE | UPDATE | DELETE | APPROVE | REJECT | UPLOAD | STAGE_CHANGE | LOGIN
  fieldName     String?
  oldValue      String?
  newValue      String?
  performedById String
  performedAt   DateTime @default(now())
  metadata      Json?    // PostgreSQL native JSON — no more JSON.stringify needed

  performedBy User @relation(fields: [performedById], references: [id])

  @@index([entityType, entityId])
  @@index([performedAt])
}

// ─── Supporting ──────────────────────────────────────────────────

model DocumentTemplate {
  id           String   @id @default(cuid())
  name         String
  description  String?
  templateType String
  fileUrl      String
  fileSize     Int
  isActive     Boolean  @default(true)
  uploadedById String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  uploadedBy User @relation("TemplateUploadedBy", fields: [uploadedById], references: [id])
}

model WorkflowStage {
  id        String   @id @default(cuid())
  key       String   @unique
  label     String
  stepOrder Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model EmployeeSequence {
  id      String @id @default("singleton")
  current Int    @default(0)
}
```

> **Note on `EmployeeSequence`:** Replaces `count() + 1` for employee codes. On every new employee: `UPDATE EmployeeSequence SET current = current + 1 WHERE id = 'singleton' RETURNING current`. This is collision-safe even when employees are deleted.

---

### V3 Environment Variables

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/recruitpro?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/recruitpro?sslmode=require"

# NextAuth v5
AUTH_SECRET="use-openssl-rand-base64-32-output-here"
AUTH_URL="https://your-domain.com"

# AWS S3 (or Vercel Blob — use BLOB_READ_WRITE_TOKEN instead)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="ap-south-1"
AWS_BUCKET="recruitpro-documents"

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="hr@yourcompany.com"

# Background jobs (Inngest)
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

---

### V3 File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root: Inter font, QueryProvider, AuthProvider
│   ├── page.tsx                      # Redirect to /dashboard or /login
│   ├── login/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── org/
│   │   │   ├── countries/route.ts
│   │   │   ├── divisions/route.ts
│   │   │   ├── states/route.ts
│   │   │   ├── branches/route.ts + [id]/route.ts
│   │   │   ├── departments/route.ts
│   │   │   └── designations/route.ts
│   │   ├── mrfs/
│   │   │   ├── route.ts              # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET detail, PATCH update
│   │   │       ├── approve/route.ts
│   │   │       ├── restart/route.ts
│   │   │       └── send-approval-email/route.ts
│   │   ├── candidates/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── stage/route.ts
│   │   │       ├── package/route.ts  # structured data for package PDF
│   │   │       └── documents/route.ts
│   │   ├── employees/
│   │   │   ├── route.ts
│   │   │   ├── me/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── dossier/route.ts  # GET everything for one employee
│   │   │       ├── onboarding-data/route.ts
│   │   │       └── report/route.ts   # GET report-optimised data
│   │   ├── documents/
│   │   │   ├── route.ts              # GET list (supports ?employeeId=), POST upload
│   │   │   └── [id]/
│   │   │       ├── route.ts          # PATCH approve, DELETE
│   │   │       ├── download/route.ts # generates signed S3 URL
│   │   │       └── apply-to-profile/route.ts
│   │   ├── interviews/
│   │   │   ├── route.ts              # GET, POST — USED in V3
│   │   │   └── [id]/route.ts         # PATCH, DELETE
│   │   ├── offers/
│   │   │   └── [candidateId]/route.ts # GET, POST/PATCH — USED in V3
│   │   ├── emails/route.ts
│   │   ├── users/route.ts + [id]/route.ts
│   │   ├── audit/route.ts            # GET audit log with entity filter
│   │   ├── document-templates/route.ts + [id]/route.ts
│   │   ├── inngest/route.ts          # Inngest webhook receiver
│   │   └── seed/route.ts             # Protected: ADMIN only
│   └── dashboard/
│       ├── layout.tsx                # Auth guard + shell
│       ├── page.tsx                  # Role-adaptive home
│       ├── mrfs/page.tsx + new/page.tsx + [id]/page.tsx + [id]/edit/page.tsx
│       ├── candidates/
│       │   ├── page.tsx
│       │   └── [id]/
│       │       ├── page.tsx
│       │       ├── documents/page.tsx
│       │       └── package/page.tsx
│       ├── employees/
│       │   ├── page.tsx              # List + Add dialog
│       │   └── [id]/
│       │       ├── page.tsx          # Employee Dossier (4 tabs)
│       │       └── report/page.tsx   # Printable Master Report
│       ├── employee-portal/page.tsx
│       ├── documents/page.tsx
│       ├── document-templates/page.tsx
│       ├── email/page.tsx
│       ├── reports/page.tsx
│       ├── users/page.tsx
│       ├── settings/page.tsx
│       └── org/
│           ├── countries/page.tsx
│           ├── departments/page.tsx
│           └── designations/page.tsx
├── components/
│   ├── layout/sidebar.tsx + topbar.tsx
│   ├── providers.tsx                 # SessionProvider + QueryClientProvider
│   └── ui/                           # all shadcn components
├── lib/
│   ├── auth.ts                       # NextAuth v5 config
│   ├── prisma.ts                     # Prisma singleton
│   ├── s3.ts                         # S3 upload + signed URL helpers
│   ├── resend.ts                     # Resend email helpers
│   ├── audit.ts                      # writeAudit() helper
│   ├── permissions.ts                # PERMISSIONS map + hasPermission()
│   ├── inngest.ts                    # Inngest client + job definitions
│   └── utils.ts                      # cn(), formatDate(), CANDIDATE_STAGES, MRF_STATUSES
└── emails/                           # react-email templates
    ├── mrf-approval.tsx
    ├── candidate-status.tsx
    └── welcome.tsx
```

---

### V3 Critical Code Patterns

#### Auth setup (`src/lib/auth.ts`)

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });
        if (!user || !user.isActive) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = (user as any).role; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).role = token.role;
      return session;
    }
  }
});

// Type augmentation — eliminates all the (session.user as {role?: string}) casts
declare module "next-auth" {
  interface Session { user: { id: string; name: string; email: string; role: string } }
}
declare module "next-auth/jwt" {
  interface JWT { id: string; role: string }
}
```

Then in any API route:
```typescript
import { auth } from "@/lib/auth";
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { id: userId, role } = session.user; // fully typed, no cast needed
```

#### Permissions (`src/lib/permissions.ts`)

```typescript
const PERMISSIONS: Record<string, string[]> = {
  ADMIN:              ["*"],
  HR:                 ["candidates", "mrfs", "employees", "documents", "emails", "reports", "users", "interviews", "offers"],
  BRANCH_MANAGER:     ["mrfs.create", "mrfs.read"],
  DIVISIONAL_MANAGER: ["mrfs.read", "mrfs.approve"],
  FUNCTIONAL_HEAD:    ["mrfs.read", "mrfs.approve"],
  COUNTRY_MANAGER:    ["mrfs.read", "mrfs.approve", "mrfs.create"],
  CANDIDATE:          ["candidates.own", "documents.own"],
  EMPLOYEE:           ["employees.own", "documents.own"],
};

export function can(role: string, resource: string): boolean {
  const perms = PERMISSIONS[role] || [];
  return perms.includes("*") || perms.some(p => p === resource || resource.startsWith(p + "."));
}

// Usage in API route — replaces every inline !["ADMIN","HR"].includes(role) check:
if (!can(role, "candidates")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

#### S3 file upload + signed URL (`src/lib/s3.ts`)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! }
});

export async function uploadToS3(file: File, folder = "documents"): Promise<{ key: string; size: number }> {
  const ext = file.name.split(".").pop();
  const key = `${folder}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }));
  return { key, size: buffer.length };
}

export async function getSignedDownloadUrl(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_BUCKET!, Key: key }), { expiresIn });
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET!, Key: key }));
}
```

Document download API (`GET /api/documents/[id]/download`):
```typescript
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Check ownership/role here before generating URL
  const url = await getSignedDownloadUrl(doc.fileUrl);
  return NextResponse.redirect(url);
}
```

#### Zod validation on every route

```typescript
import { z } from "zod";

const CreateCandidateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  mrfId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !can(session.user.role, "candidates")) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = CreateCandidateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { firstName, lastName, email, phone, mrfId } = parsed.data;
  // proceed with validated data
}
```

#### Inngest background job for document parsing (`src/lib/inngest.ts`)

```typescript
import { Inngest } from "inngest";
import { prisma } from "./prisma";

export const inngest = new Inngest({ id: "recruitpro" });

export const parseDocument = inngest.createFunction(
  { id: "parse-document" },
  { event: "document/uploaded" },
  async ({ event }) => {
    const { documentId, fileKey } = event.data;

    await prisma.document.update({ where: { id: documentId }, data: { parseStatus: "PROCESSING" } });

    try {
      // Download from S3 and parse
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      // ... parse logic here (pdf-parse, tesseract, etc.)
      const extractedData = JSON.stringify({ /* parsed fields */ });

      await prisma.document.update({
        where: { id: documentId },
        data: { extractedData, parseStatus: "DONE" }
      });
    } catch {
      await prisma.document.update({ where: { id: documentId }, data: { parseStatus: "FAILED" } });
    }
  }
);
```

Document upload API triggers the job instead of blocking on parse:
```typescript
// After saving document to DB:
await inngest.send({ name: "document/uploaded", data: { documentId: doc.id, fileKey: key } });
// Return 201 immediately — parsing happens in background
```

#### Resend email (`src/lib/resend.ts`)

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMRFApprovalEmail(params: {
  to: string; mrfNumber: string; title: string; approvalLink: string;
}) {
  const { MRFApprovalEmail } = await import("@/emails/mrf-approval");
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: params.to,
    subject: `Action Required: MRF ${params.mrfNumber} awaiting your approval`,
    react: MRFApprovalEmail(params),
  });
}
```

#### TanStack Query setup (`src/components/providers.tsx`)

```typescript
"use client";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } }
  }));
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

Usage replaces every `useEffect + fetch + useState` pattern:
```typescript
// Before (V2):
const [candidates, setCandidates] = useState([]);
useEffect(() => { fetch("/api/candidates").then(r => r.json()).then(setCandidates); }, []);

// After (V3):
const { data: candidates = [] } = useQuery({
  queryKey: ["candidates"],
  queryFn: () => fetch("/api/candidates").then(r => r.json())
});
// Auto-refetch on focus, cache 30s, no loading state bugs
```

#### Employee sequence (collision-safe employee codes)

```typescript
// In POST /api/employees, inside a transaction:
const result = await prisma.$queryRaw<[{current: number}]>`
  UPDATE "EmployeeSequence" SET current = current + 1 WHERE id = 'singleton' RETURNING current
`;
const employeeCode = `EMP-${result[0].current.toString().padStart(4, "0")}`;
```

Seed the sequence table once: `INSERT INTO "EmployeeSequence" (id, current) VALUES ('singleton', 0);`

---

### V3 Complete API Route Map

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/org/countries` | Public | Full org hierarchy |
| POST | `/api/org/countries` | ADMIN | Create country |
| GET/POST | `/api/org/divisions` | Public/ADMIN | Divisions |
| GET/POST | `/api/org/states` | Public/ADMIN | States |
| GET/POST | `/api/org/branches` | Public/ADMIN | Branches |
| DELETE | `/api/org/branches/[id]` | ADMIN | Delete branch (conflict check) |
| GET/POST | `/api/org/departments` | Public/ADMIN | Departments |
| GET/POST | `/api/org/designations` | Public/ADMIN | Designations |
| GET | `/api/mrfs` | Manager roles | MRF list (filtered by role) |
| POST | `/api/mrfs` | ADMIN/HR/BM/CM | Create MRF |
| GET/PATCH | `/api/mrfs/[id]` | Manager roles | MRF detail/update |
| POST | `/api/mrfs/[id]/approve` | Manager roles | Approve/reject |
| POST | `/api/mrfs/[id]/restart` | ADMIN/HR | Reset rejected MRF |
| POST | `/api/mrfs/[id]/send-approval-email` | ADMIN/HR | Email approver |
| GET | `/api/candidates` | ADMIN/HR | Candidate list |
| POST | `/api/candidates` | ADMIN/HR | Create (auto-creates User) |
| GET/PATCH | `/api/candidates/[id]` | ADMIN/HR/own | Detail/update |
| POST | `/api/candidates/[id]/stage` | ADMIN/HR | Advance stage |
| GET/POST | `/api/interviews` | ADMIN/HR | List/create interview records |
| PATCH/DELETE | `/api/interviews/[id]` | ADMIN/HR | Update/delete interview |
| GET/POST/PATCH | `/api/offers/[candidateId]` | ADMIN/HR | Offer detail |
| GET | `/api/employees` | ADMIN/HR | Employee list |
| POST | `/api/employees` | ADMIN/HR | Create from candidate |
| GET/PATCH | `/api/employees/[id]` | ADMIN/HR/own | Detail/update |
| GET | `/api/employees/me` | EMPLOYEE | Own employee + docs |
| GET | `/api/employees/[id]/dossier` | ADMIN/HR | Complete personnel file |
| GET/POST | `/api/employees/[id]/onboarding-data` | ADMIN/HR/own | Onboarding form data |
| GET | `/api/employees/[id]/report` | ADMIN/HR | Report-structured data |
| GET | `/api/documents` | ADMIN/HR/own | Document list (filters: candidateId, employeeId, mrfId) |
| POST | `/api/documents` | Any auth | Upload (S3 → DB → trigger Inngest) |
| PATCH/DELETE | `/api/documents/[id]` | ADMIN/HR | Approve/reject or delete |
| GET | `/api/documents/[id]/download` | Auth + ownership | Generate S3 signed URL |
| POST | `/api/documents/[id]/apply-to-profile` | ADMIN/HR | Push extractedData → onboardingData |
| GET/POST | `/api/emails` | ADMIN/HR | Email log / send |
| GET/POST | `/api/users` | ADMIN/HR | User list / create |
| PATCH | `/api/users/[id]` | ADMIN/HR | Update user |
| GET | `/api/audit` | ADMIN/HR | Audit log (filter: entityType, entityId) |
| GET/POST | `/api/document-templates` | ADMIN/HR | Template list / upload |
| POST | `/api/inngest` | Inngest HMAC | Background job receiver |
| POST | `/api/seed` | ADMIN | Idempotent seed (PROTECTED) |

---

### V3 Complete Page Map

| Page | Roles | Description |
|---|---|---|
| `/login` | Public | Email/password login |
| `/dashboard` | All | Role-adaptive home |
| `/dashboard/mrfs` | Manager roles | MRF list + pending approval banner |
| `/dashboard/mrfs/new` | ADMIN/HR/BM/CM | Create MRF form |
| `/dashboard/mrfs/[id]` | Manager roles | MRF detail + approve/reject + send email |
| `/dashboard/mrfs/[id]/edit` | ADMIN/HR | Edit MRF |
| `/dashboard/candidates` | ADMIN/HR | Candidate list (list/daily/weekly/monthly views) |
| `/dashboard/candidates/[id]` | ADMIN/HR | Candidate detail + stage + docs |
| `/dashboard/candidates/[id]/documents` | ADMIN/HR | Candidate Document Center |
| `/dashboard/candidates/[id]/package` | ADMIN/HR | Printable Candidate Package PDF |
| `/dashboard/employees` | ADMIN/HR | Employee list → links to dossier |
| `/dashboard/employees/[id]` | ADMIN/HR | **Employee Dossier** (4 tabs: Details, Recruitment, Documents, Audit) |
| `/dashboard/employees/[id]/report` | ADMIN/HR | **Employee Master Report** (printable PDF) |
| `/dashboard/employee-portal` | EMPLOYEE | 3-step onboarding flow |
| `/dashboard/documents` | ADMIN/HR | Document management (all docs, approve/reject) |
| `/dashboard/document-templates` | ADMIN/HR | HR form templates (upload + download) |
| `/dashboard/email` | ADMIN/HR | Email log + compose |
| `/dashboard/reports` | ADMIN/HR | Stats, charts, summaries |
| `/dashboard/users` | ADMIN/HR | User list + add/edit |
| `/dashboard/org/countries` | ADMIN | Org hierarchy tree |
| `/dashboard/org/departments` | ADMIN | Department grid |
| `/dashboard/org/designations` | ADMIN | Designations table |
| `/dashboard/settings` | ADMIN | System settings, seed tools |

---

### V3 Setup Commands

```bash
# 1. Create project
npx create-next-app@latest recruitpro-v3 --typescript --tailwind --app --src-dir --import-alias "@/*"
cd recruitpro-v3

# 2. Install core dependencies
npm install next-auth@beta @auth/prisma-adapter
npm install prisma @prisma/client @prisma/adapter-neon @neondatabase/serverless
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install resend react-email @react-email/components
npm install inngest
npm install bcryptjs zod
npm install @tanstack/react-query zustand
npm install lucide-react clsx tailwind-merge class-variance-authority date-fns
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label \
  @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-tabs \
  @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-dropdown-menu \
  @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-slot @radix-ui/react-toast
npm install -D @types/bcryptjs dotenv

# 3. Create .env from template above

# 4. Initialise Prisma with PostgreSQL schema (paste schema from Section 17)
npx prisma migrate dev --name init
npx prisma generate

# 5. Seed: POST /api/seed (as ADMIN after first login)

# 6. Run dev
npm run dev
```

---

### V3 Decisions That Differ from V2 — Quick Reference

| Decision | V2 | V3 | Reason |
|---|---|---|---|
| Database | SQLite (dev.db) | PostgreSQL (Neon) | Serverless-compatible, concurrent, Vercel-ready |
| File storage | `public/uploads/` local disk | AWS S3 + signed URLs | Persists across deploys, auth-gated downloads |
| Employee code | `count() + 1` | `EmployeeSequence` table | Collision-safe on delete |
| Email | nodemailer + Gmail SMTP | Resend + react-email | Reliable delivery, typed templates |
| Document parsing | Sync in upload route | Inngest background job | No timeouts, retry on failure |
| Auth session types | Manual casts everywhere | Module augmentation | Full type safety, no casts |
| API validation | None (raw `any`) | Zod on every route | Catches bad input at boundary |
| Permissions | Inline role checks in 40 routes | `permissions.ts` + `can()` | Single source of truth |
| Server state | `useEffect + useState` | TanStack Query | Caching, auto-refetch, optimistic updates |
| Employee → MRF | Indirect (via candidate) | Direct `mrfId` FK | Permanent reference, faster queries |
| Employee → Dept | Free-text string | FK to `Department` | Relational reporting |
| Onboarding PII | JSON blob | Structured columns + JSON | Queryable, reportable, auditable |
| Audit trail | None | `AuditLog` table | Compliance, debugging, history |
| Email MRF link | Raw SQL workaround | Proper Prisma relation | Clean queries |
| Interview records | Schema only, no UI/API | Fully implemented | Used in Dossier + Report |
| Offer details | Schema only, no UI/API | Fully implemented | Used in Dossier + Report |
| File access | Public URL | Signed URL (15min TTL) | Auth-gated HR documents |
