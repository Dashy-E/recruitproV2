# RecruitPro ERP — Complete Project Context

> **Purpose of this document:** Enable any AI assistant (or developer) to fully understand and recreate this application from scratch, even if the original source code is lost.

---

## 1. Project Overview

### Purpose
RecruitPro ERP is a full-stack, role-based Recruitment and Employee Management System built for a mid-to-large enterprise (Primawave / similar) with multi-country, multi-division operations. It digitises the entire hiring lifecycle: from raising a Manpower Requisition Form (MRF) → candidate pipeline → offer → joining → employee onboarding → confirmation.

### Target Users
| Role | Who they are |
|------|-------------|
| ADMIN | System administrator; full access |
| HR | HR department staff; manages candidates, MRFs, users |
| BRANCH_MANAGER | Creates MRFs for their branch |
| DIVISIONAL_MANAGER | Approves MRFs at divisional level |
| FUNCTIONAL_HEAD | Approves MRFs at functional/department level |
| COUNTRY_MANAGER | Final MRF approver at country level |
| CANDIDATE | Applicant who views their own pipeline and uploads documents |
| EMPLOYEE | A joined candidate going through onboarding in the employee portal |

### Business Goals
1. Replace manual/Excel-based MRF and candidate tracking with a structured digital workflow.
2. Enforce a multi-level MRF approval chain (Divisional → Functional → Country).
3. Track each candidate through a 15-stage recruitment pipeline with audit history.
4. Provide candidates and employees with self-service portals.
5. Store all HR-related documents with approval workflows.
6. Enable in-app email communication between HR and candidates.

### Core Functionality
- **MRF Management:** Create, submit, approve/reject manpower requisition forms across three approval levels.
- **Candidate Pipeline:** 15-stage pipeline from Applications to Confirmation Letter, with status tracking (Active / Rejected / On Hold).
- **Employee Portal:** Step-based onboarding flow: document upload → onboarding form → employee dashboard with post-join stage pipeline.
- **Document Management:** Upload, approval workflow (Pending → Approved/Rejected), file storage.
- **Email:** In-app email with optional SMTP delivery.
- **Organisation Setup:** Country → Division → State → Branch hierarchy; Departments and Designations.
- **User Management:** Create/edit users with fine-grained role-based permissions.
- **Reports:** Statistics across MRFs, candidates, departments, countries.

### Problems Being Solved
- No single source of truth for hiring status across multiple geographies.
- Manual approval chains via email/phone with no audit trail.
- Inconsistent candidate pipeline stages and scoring.
- No structured document repository for HR files.
- Difficulty onboarding new employees with no portal.

---

## 2. Architecture

### High-Level System Architecture
```
Browser (React 19 / Next.js 16 App Router)
         │
         │  HTTP (REST API + server-rendered pages)
         ▼
Next.js Server (Node.js / Edge-compatible)
   ├── App Router pages (RSC + client components)
   ├── API Routes (/api/*)
   ├── NextAuth.js (JWT authentication)
   └── Prisma ORM (LibSQL adapter)
              │
              ▼
         SQLite (dev.db)
              │
         public/uploads/  (file storage, local disk)
```

### Frontend Architecture
- **Framework:** Next.js 16.2.7 App Router
- **Rendering:** Mix of React Server Components (RSC) for auth-gated pages and `"use client"` components for interactive pages.
- **Styling:** Tailwind CSS v4 (PostCSS plugin), utility-first, responsive.
- **UI Library:** shadcn/ui (Radix UI primitives wrapped with Tailwind class-variance-authority).
- **Icons:** lucide-react v1.17.
- **State:** Local `useState` / `useEffect` in each client component. No global state manager (no Redux/Zustand/Context API for app state).
- **Auth state:** NextAuth `useSession()` hook on client; `getServerSession()` on server.

### Backend Architecture
- **Framework:** Next.js API Routes (Route Handlers in `src/app/api/`).
- **ORM:** Prisma 7.8.0 with `@prisma/adapter-libsql` (LibSQL adapter wrapping SQLite).
- **Auth:** NextAuth v4 with CredentialsProvider (email+password, JWT sessions).
- **File uploads:** Native `fs/promises` + `FormData` parsing; no multer in API routes despite multer being in `package.json`.
- **Email:** Optional SMTP via nodemailer; emails always recorded in DB even if SMTP fails.

### Database Architecture
- **Engine:** SQLite (file `dev.db` in project root).
- **Access pattern:** Prisma via LibSQL adapter (required for Next.js Edge compatibility).
- **Schema file:** `prisma/schema.prisma`.
- **Migration tool:** `prisma migrate dev` with migration history in `prisma/migrations/`.

### API Architecture
- All API routes follow Next.js App Router Route Handler conventions (`export async function GET/POST/PATCH/DELETE`).
- Auth checked on every route using `getServerSession(authOptions)`.
- RESTful resource-based URLs: `/api/[resource]` (list/create) and `/api/[resource]/[id]` (detail/update/delete).
- Special action routes: `/api/mrfs/[id]/approve`, `/api/candidates/[id]/stage`, `/api/employees/[id]` (onboardingStep).
- `params` is always awaited as a Promise (Next.js 16 dynamic params convention).

### Authentication Flow
1. User visits `/` → server checks session → redirects to `/dashboard` (authenticated) or `/login`.
2. Login page calls `signIn("credentials", { email, password })`.
3. NextAuth CredentialsProvider queries Prisma for user by email, checks `isActive`, bcrypt-compares password.
4. On success: JWT created containing `{ id, email, name, role }`.
5. JWT stored in cookie. Every subsequent request includes cookie.
6. Server-side: `getServerSession(authOptions)` reads JWT. Client-side: `useSession()` reads from NextAuth context (wrapped in Providers).
7. Dashboard layout (`src/app/dashboard/layout.tsx`) redirects to `/login` if no session.

### Data Flow Between Components
```
User action → Client component (useState)
           → fetch() to /api/[resource]
           → API Route Handler
              → getServerSession() [auth check]
              → prisma.[model].[operation]()
              → return NextResponse.json()
           → Client component updates state
           → React re-renders UI
```
For server pages (RSC): `getServerSession()` + `prisma.*` called directly in component body.

---

## 3. Technology Stack

### Languages
- **TypeScript 5** (strict mode implied by tsconfig)
- **CSS** (Tailwind utility classes; no custom CSS modules)

### Frameworks
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16.2.7 | Full-stack framework (App Router) |
| React | 19.2.4 | UI rendering |
| React DOM | 19.2.4 | DOM rendering |

### Libraries and Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| next-auth | ^4.24.14 | Authentication (JWT, CredentialsProvider) |
| @auth/prisma-adapter | ^2.11.2 | NextAuth ↔ Prisma adapter (Account, Session models) |
| prisma | ^7.8.0 | ORM CLI and migration tool |
| @prisma/client | ^7.8.0 | Generated Prisma client |
| @prisma/adapter-libsql | ^7.8.0 | LibSQL adapter for Prisma |
| @libsql/client | ^0.17.3 | LibSQL SQLite client |
| better-sqlite3 | ^12.10.0 | Alternative SQLite driver (in deps) |
| bcryptjs | ^3.0.3 | Password hashing |
| nodemailer | ^7.0.13 | SMTP email sending |
| lucide-react | ^1.17.0 | Icon library |
| tailwind-merge | ^3.6.0 | Merge Tailwind class strings |
| clsx | ^2.1.1 | Conditional className utility |
| class-variance-authority | ^0.7.1 | shadcn/ui variant system |
| date-fns | ^4.4.0 | Date utilities |
| react-hook-form | ^7.77.0 | Form handling (installed but minimally used) |
| zod | ^4.4.3 | Schema validation (installed but minimally used) |
| multer | ^2.1.1 | File upload middleware (installed, not used in API routes) |
| @hookform/resolvers | ^5.0.0 | react-hook-form + zod integration |

**Radix UI components (via shadcn/ui):**
accordion, alert-dialog, avatar, checkbox, collapsible, dialog, dropdown-menu, label, popover, progress, scroll-area, select, separator, slot, tabs, toast.

### Build Tools
- `@tailwindcss/postcss` v4 — Tailwind PostCSS plugin
- `eslint` v9 + `eslint-config-next` 16.2.7 — Linting
- `typescript` v5 — TypeScript compiler
- `dotenv` v17 — Environment variable loading for Prisma config

### Deployment Requirements
- Node.js (compatible with Next.js 16 — Node 18+)
- SQLite file (`dev.db`) writable at project root
- `public/uploads/` directory writable (auto-created by API)
- Environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Optional: SMTP server credentials for email delivery

---

## 4. Feature Inventory

### Feature 1: MRF Creation and Submission
**Purpose:** Allow Branch Managers, HR, and Admins to raise a formal Manpower Requisition Form.

**User Workflow:**
1. Navigate to MRFs → New MRF.
2. Fill in Title (required).
3. Select Country → if India: Division → Branch; if Corporate/Overseas: Country → Branch.
4. Select Department and (optionally) Designation.
5. Choose Vacancy Type: Replacement (fills replaced employee fields) or New Position (checks new role / business expansion).
6. Fill Section 3: grade, CTC range, location, reporting manager, job profile, vacancy count.
7. Fill Section 4: age range, qualifications, experience, industry background.
8. Check contribution justification checkbox.
9. Submit → MRF created with status `PENDING_DIVISIONAL`, sequential number `MRF-YYYY-NNNN`.

**Business Logic:**
- India MRFs: Division selection required; Branch filtered by Division's states.
- Overseas/Corporate MRFs: Branch optional; no Division step.
- MRF number: sequential per year, padded to 4 digits (`MRF-2026-0001`).
- Created status is always `PENDING_DIVISIONAL` (not DRAFT).
- Only ADMIN, HR, BRANCH_MANAGER can create MRFs.

**Edge Cases:**
- vacancyCount defaults to 1 if not provided.
- branchId is optional even for India MRFs (API allows null).
- Overseas/Corporate MRFs have no divisionId.

**Related Files:**
- `src/app/dashboard/mrfs/new/page.tsx`
- `src/app/api/mrfs/route.ts`
- `src/app/api/org/branches/route.ts` (divisionId param for branch filtering)

---

### Feature 2: MRF Approval Workflow
**Purpose:** Route MRF through three management levels for approval.

**User Workflow:**
1. Divisional Manager sees MRF in pending list on MRFs page.
2. Views MRF detail, clicks Approve or Reject.
3. ADMIN/HR can record an external approver's name + reference.
4. Each approval advances status; final approval sets `approvedAt` timestamp.

**Business Logic:**
- Status progression: `PENDING_DIVISIONAL` → `PENDING_FUNCTIONAL` → `PENDING_COUNTRY` → `APPROVED`.
- Each step creates an `MRFApprovalRecord` with level, approver name, status, notes, and recordedBy.
- Rejection at any step sets `REJECTED` and records `rejectionReason`.
- ADMIN/HR can approve at any level (override).
- Self-approving managers: `approverName` is auto-filled from session.
- External approval: admin enters approver name manually (records who approved off-system).
- Cannot act on `APPROVED`, `REJECTED`, or `DRAFT` MRFs.

**Related Files:**
- `src/app/dashboard/mrfs/[id]/page.tsx`
- `src/app/api/mrfs/[id]/approve/route.ts`

---

### Feature 3: Candidate Pipeline Management
**Purpose:** Track each candidate through 15 recruitment stages.

**Pipeline Stages (in order):**
| Step | Key | Label |
|------|-----|-------|
| 1 | APPLIED | Applications |
| 2 | INTERVIEW_1 | Interview – Round 1 |
| 3 | INTERVIEW_2 | Interview – Round 2 |
| 4 | INTERVIEW_3 | Interview – Round 3 |
| 5 | PSYCHOMETRIC_TEST | Psychometric Test |
| 6 | SHORTLISTED | Shortlisted / Selected |
| 7 | SALARY_NEGOTIATION | Salary Negotiation & Docs |
| 8 | CTC_OFFERED | CTC Offered |
| 9 | OFFER_LETTER | Offer Letter Issued |
| 10 | JOINED | Joined |
| 11 | ONBOARDING | Onboarding |
| 12 | EMPLOYEE_FILE | Employee File |
| 13 | EMPLOYEE_FEEDBACK | Employee Feedback |
| 14 | CONFIRMATION_PROCESS | Confirmation Process |
| 15 | CONFIRMATION_LETTER | Confirmation Letter |

**Candidate Status (separate from stage):** ACTIVE / REJECTED / ON_HOLD.
- REJECTED and ON_HOLD candidates appear in collapsed sections at the bottom of the list (when viewing ALL).
- Status can be changed independently of stage via PATCH to `/api/candidates/[id]` (`candidateStatus` + `statusNote` fields).

**User Workflow (HR/Admin):**
1. Add candidate → created at APPLIED stage, ACTIVE status, user account auto-created.
2. Move candidate to next stage via "Advance Stage" button on candidate detail.
3. Optionally mark as Rejected or On Hold with a note.
4. Candidate reaches JOINED → create Employee record to convert them.

**Business Logic:**
- Only forward stage movement (index must be higher than current stage's index in CANDIDATE_STAGES array).
- Stage history recorded for each transition.
- PSYCHOMETRIC_TEST: validated against `designation.requiresPsychometric`; if false, skip is allowed.
- Interview stages (INTERVIEW_1/2/3): when stageFilter is one of these, candidates group by `interviewDate` field.
- Creating a candidate auto-creates a User with role=CANDIDATE and a random temporary password.

**Related Files:**
- `src/app/dashboard/candidates/page.tsx`
- `src/app/dashboard/candidates/[id]/page.tsx`
- `src/app/api/candidates/route.ts`
- `src/app/api/candidates/[id]/route.ts`
- `src/app/api/candidates/[id]/stage/route.ts`
- `src/lib/utils.ts` (CANDIDATE_STAGES constant)

---

### Feature 4: Document Management
**Purpose:** Upload, store, and approve/reject HR documents linked to candidates or MRFs.

**Upload Rules:**
- CANDIDATE: Can upload only before SHORTLISTED stage (pre-shortlist: APPLIED, INTERVIEW_1, INTERVIEW_2, INTERVIEW_3). Uploaded docs status = PENDING.
- EMPLOYEE: Can upload for onboarding. Status = PENDING.
- HR/ADMIN: Can upload for any candidate/MRF. Status = AUTO-APPROVED.

**Approval Workflow:**
- PENDING → APPROVED or REJECTED (by HR/Admin with optional notes).

**File Storage:**
- Saved to `public/uploads/` with filename `{timestamp}-{sanitized-original-name}`.
- `fileUrl` stored as `/uploads/{filename}` (publicly accessible).
- DELETE removes physical file (best-effort, catches errors) then DB record.

**Document Types:** RESUME, OFFER_LETTER, APPOINTMENT_LETTER, AGREEMENT, ID_PROOF, ADDRESS_PROOF, ONBOARDING, OTHER.

**Related Files:**
- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/dashboard/documents/page.tsx`
- `src/app/dashboard/candidates/[id]/page.tsx` (uploads in candidate detail)

---

### Feature 5: Employee Portal (Onboarding)
**Purpose:** Provide EMPLOYEE-role users a step-based onboarding experience.

**Three-step flow (tracked by `Employee.onboardingStep`):**
- **Step 0:** Upload at least one document. Continue button enabled only after ≥1 doc. Clicking Continue advances `onboardingStep` to 1 via PATCH `/api/employees/{id}`.
- **Step 1:** Fill onboarding form (emergency contact name/phone, bank account number, bank name, IFSC, PAN, Aadhaar last 4 digits, permanent address, blood group). Required fields validated before Submit. Submit advances to step 2.
- **Step 2:** Full employee dashboard: employee details grid, post-join pipeline tracker (stages 11–15: Onboarding → Confirmation Letter), uploaded documents list.

**Post-join pipeline:** Shows `CANDIDATE_STAGES` steps 11–15 with current stage highlighted.

**Related Files:**
- `src/app/dashboard/employee-portal/page.tsx`
- `src/app/api/employees/me/route.ts`
- `src/app/api/employees/[id]/route.ts`
- `src/app/api/documents/route.ts`

---

### Feature 6: Email System
**Purpose:** Allow HR/Admin to send and track emails to candidates.

**Workflow:**
1. HR opens Email page, sees sent emails list.
2. Clicks Compose.
3. Optionally selects candidate (auto-fills recipient email).
4. Fills subject + body.
5. Clicks Send → API records email in DB; optionally sends via SMTP if configured.

**SMTP:** If `SMTP_HOST` is set, uses nodemailer to send. SMTP errors are caught and logged but do not block DB recording.

**Related Files:**
- `src/app/dashboard/email/page.tsx`
- `src/app/api/emails/route.ts`

---

### Feature 7: Organisation Structure Management
**Purpose:** Maintain the Country → Division → State → Branch hierarchy; Departments; Designations.

**Hierarchy:**
- Country (India / Overseas / Corporate)
  - Division (India only, e.g. "South West Division", "East Central Division")
    - State (e.g. "Gujarat", "West Bengal")
      - Branch (e.g. "Gandhidham", "Kolkata")
  - Branch (direct, for Overseas/Corporate)

**MRF form uses Division → Branch directly** (skips State in UI; API filters branches by divisionId → gets states in div → gets branches in those states).

**Branch deletion:** ADMIN only. Blocked if any User or MRF references the branch (returns 409 with count).

**Designation `requiresPsychometric` flag:** Controls whether PSYCHOMETRIC_TEST stage is required for candidates applying to that designation.

**Related Files:**
- `src/app/dashboard/org/countries/page.tsx`
- `src/app/dashboard/org/departments/page.tsx`
- `src/app/dashboard/org/designations/page.tsx`
- `src/app/api/org/*/route.ts`
- `src/app/api/org/branches/[id]/route.ts`

---

### Feature 8: User Management
**Purpose:** Create and edit system users with role-based restrictions.

**Rules:**
- HR cannot create or edit ADMIN-role users.
- HR cannot assign ADMIN role.
- CANDIDATE users are created automatically via the candidate creation flow; not via this UI.
- FUNCTIONAL_HEAD role: requires Department assignment (creates `DepartmentFunctionalHead` mapping).
- BRANCH_MANAGER role: requires Branch assignment.
- Password hashed with bcryptjs (salt rounds: 10).

**Related Files:**
- `src/app/dashboard/users/page.tsx`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`

---

### Feature 9: Reports
**Purpose:** Provide ADMIN/HR with high-level statistics.

**Displayed:**
- Total MRFs, Approved MRFs, Total Candidates, Onboarded count.
- Candidate count per pipeline stage (progress bars).
- MRF count per department (horizontal bars).
- MRF count per country (horizontal bars).
- MRF status overview (colored count boxes).
- Recent candidates table (last 10).

**Related Files:**
- `src/app/dashboard/reports/page.tsx` (server component, direct Prisma queries)

---

### Feature 10: Candidate View Mode Grouping
**Purpose:** Allow HR to view candidates grouped by day, week, month, or interview date.

**View Modes:**
- **List:** Flat table.
- **Daily:** Groups by `candidate.createdAt` date (ISO date `YYYY-MM-DD`). Label: "Mon, 01 Jan 2026".
- **Weekly:** Groups by ISO week; label shows Monday–Sunday range. e.g. "02 Jun – 08 Jun 2026".
- **Monthly:** Groups by year-month; label: "June 2026".
- **Interview Date mode (auto):** When `stageFilter` is INTERVIEW_1, INTERVIEW_2, or INTERVIEW_3, the table auto-groups by `candidate.interviewDate`. Unscheduled candidates shown in separate "Unscheduled" section.

**Related Files:** `src/app/dashboard/candidates/page.tsx`

---

## 5. UI/UX Documentation

### Login Page (`/login`)
**Purpose:** Authenticate users.
**Layout:** Centered card on gray-50 background. Globe icon + "RecruitPro ERP" title. 6 quick-login buttons (demo roles), email/password form below.
**Components:** Card, Input, Label, Button, Globe icon, Loader2 spinner.
**User Interactions:**
- Click quick login button → `doLogin(email, password)` called with hardcoded credentials.
- Submit form → NextAuth `signIn("credentials")` → redirect to `/dashboard` on success.
- Error displayed as red paragraph below form.

**Quick Access Accounts:**
| Label | Email | Password | Color |
|-------|-------|----------|-------|
| Admin | admin@recruitpro.com | admin123 | purple-600 |
| HR | hr@recruitpro.com | hr123 | blue-600 |
| Branch Mgr | bm@recruitpro.com | bm123 | green-600 |
| Div. Manager | dm@recruitpro.com | dm123 | yellow-600 |
| Candidate | candidate@recruitpro.com | candidate123 | gray-600 |
| Employee | employee@recruitpro.com | emp123 | teal-600 |

---

### Dashboard Layout (`/dashboard/*`)
**Purpose:** Shell for all authenticated pages.
**Layout:** Full-height flex row. Left: Sidebar (w-64, gray-900). Right: flex column → Topbar (h-16, white, border-b) + scrollable main content (p-6).
**Auth guard:** Server component; `getServerSession()` → redirect to `/login` if no session.

---

### Topbar (`src/components/layout/topbar.tsx`)
**Purpose:** Page title + user avatar.
**Components:** White header bar, h1 title (from `pageTitles` map), Bell icon button (decorative), user initial avatar circle (blue-600).

**`pageTitles` map:**
```
/dashboard → "Dashboard"
/dashboard/mrfs → "Manpower Requisition Forms"
/dashboard/mrfs/new → "New MRF"
/dashboard/candidates → "Candidates"
/dashboard/documents → "Documents"
/dashboard/reports → "Reports"
/dashboard/org/countries → "Countries & Branches"
/dashboard/org/departments → "Departments"
/dashboard/org/designations → "Designations"
/dashboard/users → "User Management"
/dashboard/settings → "Settings"
```
Dynamic routes (e.g. `/dashboard/mrfs/[id]`) fall back to "RecruitPro ERP".

---

### Sidebar (`src/components/layout/sidebar.tsx`)
**Purpose:** Navigation.
**Layout:** w-64, gray-900 background, white text. Logo section (h-16, border-b gray-700). Scrollable nav list. User profile section at bottom (border-t gray-700, Sign Out button).
**Active state:** `bg-blue-600 text-white` on active link.
**Collapsible:** Organisation menu uses `useState(openMenus)` — chevron rotates on expand.
**Role-based visibility:** `visibleItems = navItems.filter(item => !item.roles || item.roles.includes(role))`.

**Nav items and their role restrictions:**
| Item | Roles |
|------|-------|
| Dashboard | All |
| MRFs | ADMIN, HR, BRANCH_MANAGER, DIVISIONAL_MANAGER, FUNCTIONAL_HEAD, COUNTRY_MANAGER |
| Candidates | ADMIN, HR |
| Documents | ADMIN, HR |
| Reports | ADMIN, HR |
| Organization (collapsible) | ADMIN |
| Users | ADMIN, HR |
| Employees | ADMIN, HR |
| Email | ADMIN, HR |
| Employee Portal | EMPLOYEE |
| Settings | ADMIN |

---

### Main Dashboard (`/dashboard`)
**ADMIN/HR/Manager view:**
- 4 stat cards (gray-50 border, colored icons): Total MRFs (blue), Approved (green), Pending (yellow), Candidates (purple).
- Candidate stage pipeline: table of all stages with count + visual progress bar (blue fill).
- Recent MRFs: 5-row table with MRF number, title, status badge, branch, created-by.

**CANDIDATE view:**
- Blue welcome banner.
- If no candidate record: "No application found" message.
- If candidate exists: position info + 15-step pipeline (completed=green circle ✓, current=blue circle, pending=gray circle).
- If candidate has Employee record: green "You are now an employee" banner + employee code/dept/designation/joining date.

**EMPLOYEE view:**
- Redirects to `/dashboard/employee-portal` via `redirect()` from `next/navigation`.

---

### MRF List (`/dashboard/mrfs`)
**Layout:** Page title + count. Pending approvals banner (manager-role specific). Status summary cards row (6 status cards with counts). Search bar. Full-width table.
**Table columns:** MRF Number, Title (+ dept/branch/country subtitle), Department, Vacancies, Candidates (count), Status badge, Created, View link.
**Filter:** Client-side search on title, MRF number, department name, branch name.
**Pending banner:** Only visible to DIVISIONAL_MANAGER (PENDING_DIVISIONAL), FUNCTIONAL_HEAD (PENDING_FUNCTIONAL), COUNTRY_MANAGER (PENDING_COUNTRY). Shows table of their pending MRFs.

---

### New MRF (`/dashboard/mrfs/new`)
**Layout:** Single-page scrollable form divided into labelled sections. Back navigation link. Submit button fixed at bottom.
**Sections:**
1. MRF Reference: text input for title.
2. Location: Country → Division (India) or direct → Branch.
3. Vacancy Type: Radio (Replacement / New Position) with conditional sub-sections.
4. Position Details: Dept, Designation, Grade, CTC range, Location, Reporting, Job Profile, Vacancy count.
5. Candidate Specifications: Age min/max, qualifications, experience, industry, other specs.
6. Certification: Checkbox for contribution justification.

**Validation:** `isValid()` function gates the Submit button. India requires selectedDivision + selectedBranch.

---

### MRF Detail (`/dashboard/mrfs/[id]`)
**Layout:** 2-column. Left: MRF details card. Right: approval timeline (3 steps with icons, status dots, approver names, timestamps). Below: Candidates table. Approval/Rejection modal dialog.
**Approval dialog:** For managers → approverName auto-filled. For ADMIN/HR → empty (external approval recording).
**Status badge:** Color-coded per `MRF_STATUSES` constant.

---

### Candidates List (`/dashboard/candidates`)
**Layout:** Header with view toggle (List/Daily/Weekly/Monthly buttons). Horizontal scrolling stage pipeline cards. Status filter tabs. Card with search+stage filter. Main content area.
**Collapsible sections:** Used for grouped views and for Rejected/On Hold sections.
**CandidateRow:** Name, Email, MRF/Position (title + dept + branch + country), Stage badge + Status badge, AI Score (green≥70%, orange<70%), Added date, View link.

---

### Candidate Detail (`/dashboard/candidates/[id]`)
**Layout:** 2-column top section (Overview card left, Pipeline card right). Full-width sections below: Stage History, Documents.
**Edit dialog:** Scrollable (`max-h-[90vh] overflow-y-auto`). Fields: First Name, Last Name, Email, Phone, Password (single field, changes user password), AI Score, AI Score Notes, Resume URL, Link to MRF (dropdown with "— None (unlink) —" option).
**Advance Stage dialog:** Select next stage from dropdown (only stages after current shown), optional notes.
**Document section:** Document type selector, Upload button (file input hidden), list of docs with approval status badges, Approve/Reject/Delete actions.
**Status buttons (ADMIN/HR):** "Mark Rejected", "Mark On Hold", "Restore Active" — call PATCH `/api/candidates/{id}` with `candidateStatus` field.

---

### Employees List (`/dashboard/employees`)
**Layout:** Header + table. "Add Employee" dialog to convert JOINED candidate → Employee record.
**Table:** Employee Code (monospace), Name + Email, Department, Designation, Branch, Joining Date, CTC (₹ formatted).
**Add dialog:** Candidate dropdown (filtered to JOINED stage with no existing Employee record), joining date, dept, designation, CTC, reporting to, branch.

---

### Employee Portal (`/dashboard/employee-portal`)
**Layout:** Max-w-3xl centered. Teal welcome banner. Step progress indicators. Step content card.
**Step 0 (Upload Docs):** File list (if any), Upload button (hidden file input), Continue button (disabled until ≥1 doc).
**Step 1 (Form):** 2-column grid of 9 form fields. Required: emergency contact, phone, bank account, bank name, IFSC, PAN, Aadhaar. Optional: address, blood group. Submit disabled until required fields filled.
**Step 2 (Dashboard):** Employee details card (2-column grid), Pipeline tracker (Onboarding → Confirmation Letter), Documents list.

---

### Email Page (`/dashboard/email`)
**Layout:** 3-column. Left (1/3): email list with count header. Center+Right (2/3): email detail view. Compose button top-right.
**Email list item:** Subject (truncated), recipient email, linked candidate name (if any), date.
**Compose dialog:** Candidate selector (optional, auto-fills toEmail), toEmail, subject, body textarea.

---

### Documents Page (`/dashboard/documents`)
**Layout:** Header with total count + pending review count. Filter tab row (ALL, PENDING, APPROVED, REJECTED). Document type summary row (5 type badges with counts). Full-width table.
**Table:** Filename (link), Type badge, Linked To, Uploaded By, Size (KB/MB), Date, Status badge, Actions.
**Actions:** For PENDING docs: Approve (green) + Reject (red) buttons.

---

### Reports Page (`/dashboard/reports`)
**Layout:** Server-rendered. 4 summary cards. 3-column grid: pipeline chart, by-dept chart, by-country chart. Status overview row. Recent candidates table.

---

### Users Page (`/dashboard/users`)
**Layout:** Header with count + role summary badges. Search bar. Table with Edit (pencil icon) column.
**Add dialog:** 6 form fields. Conditional branch/dept selector based on role.
**Edit dialog:** Same fields + password change (with confirm). HR restriction enforced.

---

### Countries & Branches (`/dashboard/org/countries`)
**Layout:** Countries grouped under "India", "Overseas", "Corporate" headers. Expandable country cards. India cards show Division → State → Branch tree. Overseas/Corporate show flat branch list.
**Branch chip:** Name + code + hover-reveal trash icon for deletion.

---

### Settings Page (`/dashboard/settings`)
**Layout:** Server-rendered. Stats row. System info card + Role permissions table. Recent users. Developer Tools section with seed endpoint links.

---

## 6. Database Documentation

### Model: Country
**Purpose:** Top-level geographic/business entity (India, Overseas countries, Corporate).
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid() | |
| name | String | @unique | |
| code | String | @unique | e.g. "IN", "AU", "CORP" |
| locationType | String | default "OVERSEAS" | INDIA / OVERSEAS / CORPORATE |
| isActive | Boolean | default true | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |

**Relations:** divisions[], branches[], users[], mrfs[], countryAssignments[].

---

### Model: Division
**Purpose:** Subdivision of India (e.g. "South West Division", "East Central Division").
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, cuid() |
| name | String | Unique per country (name+countryId @@unique) |
| countryId | String | FK → Country |
| isActive | Boolean | default true |

**Relations:** country, states[], mrfs[].

---

### Model: State
**Purpose:** State within a Division (e.g. "Gujarat", "West Bengal").
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, cuid() |
| name | String | Unique per division (name+divisionId @@unique) |
| divisionId | String | FK → Division |
| isActive | Boolean | default true |

**Relations:** division, branches[].

---

### Model: Branch
**Purpose:** Specific office/lab/location within a Country/State.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, cuid() |
| name | String | |
| code | String | @unique (e.g. "BBSR", "KOL", "RPR-LAB") |
| countryId | String | FK → Country |
| stateId | String? | FK → State (null for Overseas/Corporate) |
| isActive | Boolean | default true |

**Relations:** country, state?, users[], mrfs[], employees[].

**Seeded branches:** Gandhidham (GDM), Mumbai (MUM), Kolkata (KOL), Bhubaneswar (BBSR), Raipur Lab (RPR-LAB), Kolkata HO (KOL-HO), Delhi HO (DEL-HO), Central Lab (CTRL-LAB), Udayayan Lab (UDYN-LAB), and more from extend-org.

---

### Model: Department
**Purpose:** Business department (Operations, Finance, HR, Engineering, IT, Procurement, Safety, Marketing).
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, cuid() |
| name | String | @unique |
| isActive | Boolean | default true |

**Relations:** mrfs[], functionalHeadMappings[], designations[].

---

### Model: DepartmentFunctionalHead
**Purpose:** Maps a FUNCTIONAL_HEAD user to a Department.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| departmentId | String | FK → Department |
| userId | String | FK → User |
| countryId | String? | optional scope |
| stateId | String? | optional scope |

**Unique:** departmentId + userId.

---

### Model: Designation
**Purpose:** Job title within a department; carries psychometric test requirement flag.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| title | String | @unique |
| departmentId | String | FK → Department |
| requiresPsychometric | Boolean | default false |
| isActive | Boolean | default true |

**Seeded designations:** Manager (requiresPsychometric=true), Senior Engineer (true), Engineer (false), Analyst (false), HR Executive (false), IT Specialist (false), Procurement Officer (false), Safety Officer (true).

---

### Model: User
**Purpose:** Authentication and identity for all roles.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, cuid() |
| name | String | |
| email | String | @unique |
| password | String | bcrypt hash |
| role | String | default "CANDIDATE". Values: ADMIN, HR, BRANCH_MANAGER, DIVISIONAL_MANAGER, FUNCTIONAL_HEAD, COUNTRY_MANAGER, CANDIDATE, EMPLOYEE |
| branchId | String? | FK → Branch |
| countryId | String? | FK → Country |
| isActive | Boolean | default true |

**Relations:** branch?, country?, sessions[], accounts[], createdMRFs[], functionalHeadOf[], countryAssignments[], candidateProfile?, mrfApprovalRecords[], recordedApprovals[], uploadedDocuments[], interviews[], sentEmails[].

---

### Model: MRF (Manpower Requisition Form)
**Purpose:** Formal request for hiring, with multi-level approval workflow.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| mrfNumber | String | @unique. Format: MRF-YYYY-NNNN |
| title | String | |
| countryId | String | FK → Country |
| divisionId | String? | FK → Division |
| branchId | String? | FK → Branch |
| departmentId | String | FK → Department |
| designationId | String? | FK → Designation |
| vacancyCount | Int | default 1 |
| justification | String? | |
| status | String | default "DRAFT". Values: DRAFT, PENDING_DIVISIONAL, PENDING_FUNCTIONAL, PENDING_COUNTRY, APPROVED, REJECTED |
| createdById | String | FK → User |
| approvedAt | DateTime? | |
| rejectedAt | DateTime? | |
| rejectionReason | String? | |
| vacancyType | String? | NEW / REPLACEMENT |
| replacedEmployeeName | String? | |
| replacedEmployeeCTC | String? | |
| replacementFor | String? | |
| replacementReason | String? | |
| replacementNecessityReason | String? | |
| isNewRole | Boolean | default false |
| isBusinessExpansion | Boolean | default false |
| newRoleJustification | String? | |
| isBudgeted | Boolean? | |
| proposedGrade | String? | |
| ctcRange | String? | |
| location | String? | |
| reportingTo | String? | |
| jobProfile | String? | |
| minAge | Int? | |
| maxAge | Int? | |
| minQualification | String? | |
| preferredQualification | String? | |
| workExperience | String? | |
| industryBackground | String? | |
| otherSpecs | String? | |
| contributionJustified | Boolean | default false |

---

### Model: MRFApprovalRecord
**Purpose:** Audit log of each approval action at each MRF approval level.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| mrfId | String | FK → MRF |
| level | String | DIVISIONAL_MANAGER / FUNCTIONAL_HEAD / COUNTRY_MANAGER |
| approverId | String? | FK → User (null if external) |
| approverName | String | Display name |
| status | String | PENDING / APPROVED / REJECTED |
| notes | String? | |
| recordedById | String | FK → User (who recorded the action) |
| recordedAt | DateTime | default now() |
| documentId | String? | FK → Document |

---

### Model: Candidate
**Purpose:** Job applicant profile linked to a User and optionally an MRF.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| userId | String | @unique FK → User |
| mrfId | String? | FK → MRF |
| firstName | String | |
| lastName | String | |
| email | String | @unique |
| phone | String? | |
| currentStage | String | default "APPLIED" |
| aiScore | Float? | 0–100 |
| aiScoreNotes | String? | |
| resumeUrl | String? | |
| isActive | Boolean | default true |
| candidateStatus | String | default "ACTIVE". ACTIVE / REJECTED / ON_HOLD |
| statusNote | String? | |
| interviewDate | DateTime? | |

**Relations:** user, mrf?, stageHistory[], interviews[], documents[], offerDetail?, employee?, emails[].

---

### Model: CandidateStageHistory
**Purpose:** Audit trail of every stage transition for a candidate.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| candidateId | String | FK → Candidate |
| fromStage | String? | null for initial APPLIED |
| toStage | String | |
| notes | String? | |
| changedAt | DateTime | default now() |

---

### Model: Employee
**Purpose:** Employee record created when a candidate reaches/passes JOINED stage and HR converts them.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| candidateId | String | @unique FK → Candidate |
| employeeCode | String | @unique. Format: EMP-NNNN |
| joiningDate | DateTime | |
| department | String? | Free text (not FK) |
| designation | String? | Free text (not FK) |
| ctc | Float? | Annual CTC in INR |
| reportingTo | String? | Manager name (free text) |
| branchId | String? | FK → Branch |
| isActive | Boolean | default true |
| onboardingStep | Int | default 0. 0=upload docs, 1=fill form, 2=complete |

**Relations:** candidate, branch?.

---

### Model: Document
**Purpose:** Uploaded file linked to a candidate or MRF.
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| name | String | Original filename |
| fileUrl | String | `/uploads/{filename}` |
| fileType | String | MIME type |
| fileSize | Int | Bytes |
| documentType | String | default "OTHER" |
| uploadedById | String | FK → User |
| candidateId | String? | FK → Candidate |
| mrfId | String? | FK → MRF |
| approvalStatus | String | default "PENDING". PENDING / APPROVED / REJECTED |
| approvalNotes | String? | |
| createdAt | DateTime | default now() |

---

### Model: Email
**Purpose:** In-app email record (sent by HR/Admin to candidates).
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| fromId | String | FK → User |
| toEmail | String | |
| subject | String | |
| body | String | |
| isRead | Boolean | default false |
| sentAt | DateTime | default now() |
| candidateId | String? | FK → Candidate |
| mrfId | String? | FK → MRF |

---

### Model: InterviewRecord
**Purpose:** Scheduled/completed interview record (schema exists; not used in any current API or UI).
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| candidateId | String | FK → Candidate |
| interviewerId | String | FK → User |
| scheduledAt | DateTime | |
| completedAt | DateTime? | |
| result | String? | |
| notes | String? | |

---

### Model: OfferDetail
**Purpose:** Salary offer details for a candidate (schema exists; not used in any current API or UI).
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| candidateId | String | @unique |
| offeredSalary | Float? | |
| offeredAt | DateTime | |
| acceptedAt | DateTime? | |
| probationEndAt | DateTime? | |
| notes | String? | |

---

### Migration History
| Migration | Description |
|-----------|-------------|
| 20260605065807_init | Initial schema (all core models) |
| 20260605104753_add_document_approval_status | Added `approvalStatus` and `approvalNotes` to Document |
| 20260605114329_make_mrf_branch_optional | Made `branchId` nullable on MRF |
| 20260608061847_pipeline_mrf_employee_email | Added `candidateStatus`, `statusNote`, `interviewDate` to Candidate; Email model; Employee model; extended MRF fields |
| 20260609074615_add_employee_onboarding_step | Added `onboardingStep Int @default(0)` to Employee |

---

## 7. API Documentation

### Authentication
**`GET/POST /api/auth/[...nextauth]`**
- NextAuth handler. Handles sign-in, sign-out, session, callbacks.
- Credential provider: validates email+password, returns `{id, email, name, role}`.

---

### Candidates

**`GET /api/candidates`**
- Auth: session required. Role: ADMIN, HR.
- Query: `stage` (optional), `mrfId` (optional).
- Returns: array of candidates with user, mrf (dept, branch.state, country), stageHistory, employee. Ordered by createdAt desc.

**`POST /api/candidates`**
- Auth: ADMIN, HR.
- Body: `{ firstName, lastName, email, phone?, mrfId? }`.
- Creates User (role=CANDIDATE, random bcrypt temp password) if email not found, then Candidate + initial stage history (`APPLIED`).
- Returns: 201 with candidate.

**`GET /api/candidates/[id]`**
- Auth: any session. CANDIDATE role limited to own profile (checks `candidate.userId === session.user.id`).
- Returns: full candidate with user, mrf, stageHistory, interviews (with interviewer.name), documents (with uploadedBy.name), offerDetail.

**`PATCH /api/candidates/[id]`**
- Auth: ADMIN, HR.
- Body: any candidate fields. Special: `newPassword` stripped and applied to linked User. `candidateStatus` + `statusNote` for status changes.
- Returns: updated candidate.

**`POST /api/candidates/[id]/stage`**
- Auth: ADMIN, HR.
- Body: `{ toStage, notes? }`.
- Validates: `toStage` index > current stage index. If `toStage === PSYCHOMETRIC_TEST`, checks `mrf.designation.requiresPsychometric`.
- Creates stage history, updates currentStage.
- Returns: updated candidate.

---

### Documents

**`GET /api/documents`**
- Auth: session required. ADMIN/HR see all; CANDIDATE/EMPLOYEE see only own (by userId → candidateId).
- Query: `candidateId` (optional filter).
- Returns: array with uploadedBy.name, candidate.firstName/lastName, mrf.mrfNumber/title. Ordered by createdAt desc.

**`POST /api/documents`**
- Auth: session required. Content-Type: multipart/form-data.
- FormData: `file` (required), `documentType`, `candidateId?`, `mrfId?`.
- EMPLOYEE: own profile only, no stage restriction, approvalStatus=PENDING.
- CANDIDATE: own profile only, only at stages APPLIED/INTERVIEW_1/2/3, approvalStatus=PENDING.
- ADMIN/HR: any, approvalStatus=APPROVED.
- Saves to `public/uploads/{timestamp}-{sanitized-name}`.
- Returns: 201 with document record.

**`PATCH /api/documents/[id]`**
- Auth: ADMIN, HR.
- Body: `{ approvalStatus: "APPROVED"|"REJECTED", approvalNotes? }`.
- Returns: updated document.

**`DELETE /api/documents/[id]`**
- Auth: ADMIN, HR.
- Deletes physical file from `public/uploads/` (best-effort) then DB record.
- Returns: `{ success: true }`.

---

### Emails

**`GET /api/emails`**
- Auth: ADMIN, HR.
- Returns: emails where `fromId === userId`, includes candidate.firstName/lastName. Ordered by sentAt desc.

**`POST /api/emails`**
- Auth: ADMIN, HR.
- Body: `{ toEmail, subject, body, candidateId?, mrfId? }`.
- Attempts SMTP send (if SMTP_HOST set). SMTP errors caught, non-blocking.
- Always creates Email record in DB.
- Returns: 201 with email record.

---

### Employees

**`GET /api/employees`**
- Auth: ADMIN, HR.
- Returns: all Employee records with candidate (firstName, lastName, email, phone, mrf.department) and branch.name. Ordered by joiningDate desc.

**`POST /api/employees`**
- Auth: ADMIN, HR.
- Body: `{ candidateId, joiningDate, department?, designation?, ctc?, reportingTo?, branchId? }`.
- Generates employeeCode: `EMP-{count+1 padded to 4}`.
- Returns: 201 with employee + candidate + branch.

**`PATCH /api/employees/[id]`**
- Auth: session required.
- EMPLOYEE role: can only update own `onboardingStep` (integer). Validates ownership via userId → candidateId → employeeId.
- ADMIN/HR: can update any fields.
- Returns: updated employee.

**`GET /api/employees/me`**
- Auth: session required (any role).
- Returns: `{ employee: Employee|null, documents: Document[] }` for the current user's linked candidate/employee.

---

### MRFs

**`GET /api/mrfs`**
- Auth: session required.
- Query: `status?`, `countryId?`.
- Returns: all MRFs with full relations + `_count.candidates`. Ordered by createdAt desc.

**`POST /api/mrfs`**
- Auth: ADMIN, HR, BRANCH_MANAGER.
- Body: `{ title, countryId, departmentId, divisionId?, branchId?, designationId?, vacancyCount?, justification?, ...all MRF extended fields }`.
- Generates sequential `mrfNumber`: queries last MRF with `MRF-{year}-` prefix, parses suffix, increments.
- Sets `status: "PENDING_DIVISIONAL"`.
- Returns: 201 with created MRF.

**`GET /api/mrfs/[id]`**
- Auth: session required.
- Returns: full MRF with all relations including approvalRecords (ordered by recordedAt desc), candidates (with user), documents (with uploadedBy).

**`PATCH /api/mrfs/[id]`**
- Auth: ADMIN, HR.
- Body: any MRF fields.
- Returns: updated MRF.

**`POST /api/mrfs/[id]/approve`**
- Auth: ADMIN, HR, DIVISIONAL_MANAGER, FUNCTIONAL_HEAD, COUNTRY_MANAGER.
- Body: `{ action: "approve"|"reject", approverName?, notes? }`.
- Validates: MRF not APPROVED/REJECTED/DRAFT.
- Role→level map: DIVISIONAL_MANAGER↔PENDING_DIVISIONAL, FUNCTIONAL_HEAD↔PENDING_FUNCTIONAL, COUNTRY_MANAGER↔PENDING_COUNTRY.
- Approve: creates approval record, advances status. On final PENDING_COUNTRY approve: status=APPROVED, approvedAt=now().
- Reject: creates rejection record, status=REJECTED, rejectedAt=now().
- Uses `prisma.$transaction()` for atomic DB operations.
- Returns: `{ success: true }`.

---

### Users

**`GET /api/users`**
- Auth: ADMIN, HR.
- Returns: all users with branch.name, country.name. Ordered by createdAt desc.

**`POST /api/users`**
- Auth: ADMIN, HR.
- Body: `{ name, email, password, userRole, branchId?, countryId?, departmentId?, divisionId? }`.
- HR cannot create ADMIN. Cannot create CANDIDATE via this route.
- Hashes password. If FUNCTIONAL_HEAD + departmentId: creates DepartmentFunctionalHead.
- Returns: 201 with user (no password field).

**`PATCH /api/users/[id]`**
- Auth: ADMIN, HR.
- Body: any user fields (`name`, `email`, `password`, `userRole`, `branchId`, `countryId`, `isActive`).
- HR cannot edit ADMIN users or assign ADMIN role.
- Returns: updated user with branch/country.

---

### Organisation

**`GET /api/org/countries`** — No auth. Returns countries with divisions→states→branches + top-level branches.
**`POST /api/org/countries`** — ADMIN. Creates country.
**`GET /api/org/divisions`** — No auth. Query: `countryId?`. Returns divisions with states and branches.
**`POST /api/org/divisions`** — **No auth (open)**. Creates division.
**`GET /api/org/states`** — No auth. Query: `divisionId?`. Returns states with branches.
**`POST /api/org/states`** — **No auth (open)**. Creates state.
**`GET /api/org/branches`** — No auth. Query: `countryId?`, `stateId?`, `divisionId?`. `divisionId` triggers special lookup (states→branches in that division). Returns only `isActive=true` branches.
**`POST /api/org/branches`** — ADMIN. Body: `{ name, code, countryId, stateId? }`.
**`DELETE /api/org/branches/[id]`** — ADMIN. Blocked (409) if users or MRFs reference branch. Deletes otherwise.
**`GET /api/org/departments`** — No auth. Returns departments with designations + MRF _count.
**`POST /api/org/departments`** — ADMIN. Body: `{ name }`.
**`GET /api/org/designations`** — No auth. Returns designations with department. Ordered by title.
**`POST /api/org/designations`** — ADMIN. Body: `{ title, departmentId, requiresPsychometric? }`.

---

### Seed

**`POST /api/seed`** — No auth. Idempotent (skips if admin exists). Creates full demo dataset (countries, divisions, states, branches, departments, designations, demo users, sample MRFs and candidates).
**`POST /api/seed/extend-org`** — No auth. Idempotent. Adds additional states/branches to South West and East Central divisions.
**`POST /api/seed/fix-org`** — ADMIN only. Fixes: renames Bhubaneswar branch code to BBSR, creates Raipur Lab/Central Lab/Udayayan Lab branches, creates demo employee user.

---

## 8. Business Rules

### Validation Rules
- MRF title, countryId, departmentId are required for MRF creation.
- Candidate firstName, lastName, email are required.
- User name, email, password are required; email must be unique.
- Branch deletion blocked if users or MRFs reference it.
- Employee code: `EMP-{count+1}` — NOT sequential from last code, uses total count. Risk of collisions if records deleted.
- MRF number: sequential by year, based on last MRF number with matching year prefix.

### Role-Based Access Control
| Resource | ADMIN | HR | BRANCH_MGR | DIV_MGR | FUNC_HEAD | COUNTRY_MGR | CANDIDATE | EMPLOYEE |
|----------|-------|----|-----------|---------|-----------|-------------|-----------|---------|
| Create MRF | ✓ | ✓ | ✓ | | | | | |
| Approve MRF (div) | ✓ | ✓ | | ✓ | | | | |
| Approve MRF (func) | ✓ | ✓ | | | ✓ | | | |
| Approve MRF (country) | ✓ | ✓ | | | | ✓ | | |
| View MRFs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Manage candidates | ✓ | ✓ | | | | | | |
| View own pipeline | | | | | | | ✓ | |
| Upload docs (own) | | | | | | | ✓ (pre-shortlist) | ✓ (onboarding) |
| Approve docs | ✓ | ✓ | | | | | | |
| Manage users | ✓ | ✓* | | | | | | |
| Manage org | ✓ | | | | | | | |
| View reports | ✓ | ✓ | | | | | | |
| Employee portal | | | | | | | | ✓ |

*HR cannot create/edit ADMIN users.

### Workflow Rules
1. MRF approval is strictly ordered: Divisional → Functional → Country.
2. Candidate stage progression is forward-only (cannot move backward).
3. Psychometric test: required if `designation.requiresPsychometric === true`; skippable if false.
4. Employee onboarding steps are sequential: 0→1→2 only.
5. Document uploads by candidates: only allowed at stages APPLIED, INTERVIEW_1, INTERVIEW_2, INTERVIEW_3.

### Special Conditions / Hidden Assumptions
- `generateMRFNumber()` in `utils.ts` uses random numbers (legacy function); actual sequential generation is in an async function inside `src/app/api/mrfs/route.ts`. The `utils.ts` version is not called from any current path.
- `POST /api/org/divisions` and `POST /api/org/states` have NO auth check — any unauthenticated user could POST to create divisions/states.
- `topbar.tsx` contains a reference to `/dashboard/my-application` in `pageTitles` — this page was removed but the mapping was not cleaned up (dead code, no error).
- `Employee.department` and `Employee.designation` are free-text strings, not FK relations to the Department/Designation models.
- Employee code generation uses `count + 1` which can produce duplicates if records are deleted.
- The CANDIDATE creation API auto-generates a random temp password using `Math.random()` — not cryptographically secure. The password is not emailed.

---

## 9. Application State Management

### Global State
- **NextAuth session:** Available via `useSession()` (client) or `getServerSession()` (server). Contains `{ id, name, email, role }`.
- **No Redux/Zustand/Context for app data.** Each page fetches its own data independently.

### Local State Pattern
Each client page component maintains its own state:
- `loading`: tracks initial data fetch.
- `[resource]`: stores fetched data (array or object).
- `showDialog` / `dialog`: boolean or string to control modal visibility.
- `form`: object holding current form field values.
- `submitting`: boolean for form submission in-progress.
- `search`: string for client-side search filtering.

### Data Fetching Strategy
- **Server pages (RSC):** Direct Prisma calls in async component body. No caching.
- **Client pages:** `useEffect(() => { fetch('/api/...').then(...) }, [])` pattern. No SWR/React Query.
- Re-fetch after mutations: call the same fetch function (`fetchCandidates()`, `fetchEmployees()`, etc.) after POST/PATCH/DELETE completes.
- **No optimistic updates.** All mutations wait for API response before re-fetching.

### Caching Strategy
- None explicitly. Next.js App Router default fetch caching is not leveraged (fetch calls are in client components or use Prisma directly).

---

## 10. File Structure

```
c:\Users\amitk\OneDrive\Desktop\recruitpro-erp\
├── dev.db                          # SQLite database
├── prisma/
│   ├── schema.prisma               # Complete data model definition
│   ├── config.ts / prisma.config.ts # Prisma config (datasource, migration path)
│   └── migrations/
│       ├── 20260605065807_init/
│       ├── 20260605104753_add_document_approval_status/
│       ├── 20260605114329_make_mrf_branch_optional/
│       ├── 20260608061847_pipeline_mrf_employee_email/
│       └── 20260609074615_add_employee_onboarding_step/
├── public/
│   └── uploads/                    # Uploaded files (auto-created by API)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout: metadata, Inter font, Providers
│   │   ├── page.tsx                # Root page: redirect to /dashboard or /login
│   │   ├── globals.css             # Global Tailwind CSS
│   │   ├── login/
│   │   │   └── page.tsx            # Login page with quick-access buttons
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts    # NextAuth handler
│   │   │   ├── candidates/
│   │   │   │   ├── route.ts                   # GET list, POST create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts               # GET detail, PATCH update
│   │   │   │       └── stage/route.ts         # POST advance stage
│   │   │   ├── documents/
│   │   │   │   ├── route.ts                   # GET list, POST upload
│   │   │   │   └── [id]/route.ts              # PATCH approve, DELETE delete
│   │   │   ├── emails/route.ts                # GET list, POST send
│   │   │   ├── employees/
│   │   │   │   ├── route.ts                   # GET list, POST create
│   │   │   │   ├── [id]/route.ts              # PATCH update (incl. onboardingStep)
│   │   │   │   └── me/route.ts                # GET own employee + docs
│   │   │   ├── mrfs/
│   │   │   │   ├── route.ts                   # GET list, POST create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts               # GET detail, PATCH update
│   │   │   │       └── approve/route.ts       # POST approval workflow
│   │   │   ├── org/
│   │   │   │   ├── branches/
│   │   │   │   │   ├── route.ts               # GET (with divisionId), POST create
│   │   │   │   │   └── [id]/route.ts          # DELETE (ADMIN, conflict check)
│   │   │   │   ├── countries/route.ts         # GET full hierarchy, POST create
│   │   │   │   ├── departments/route.ts       # GET with designations, POST create
│   │   │   │   ├── designations/route.ts      # GET with dept, POST create
│   │   │   │   ├── divisions/route.ts         # GET (countryId?), POST create
│   │   │   │   └── states/route.ts            # GET (divisionId?), POST create
│   │   │   ├── users/
│   │   │   │   ├── route.ts                   # GET list, POST create
│   │   │   │   └── [id]/route.ts              # PATCH update
│   │   │   └── seed/
│   │   │       ├── route.ts                   # POST initial seed (idempotent)
│   │   │       ├── extend-org/route.ts        # POST extend org (idempotent)
│   │   │       └── fix-org/route.ts           # POST fix org (ADMIN only, idempotent)
│   │   └── dashboard/
│   │       ├── layout.tsx                     # Auth guard + Shell (Sidebar + Topbar)
│   │       ├── page.tsx                       # Role-based home dashboard (RSC)
│   │       ├── mrfs/
│   │       │   ├── page.tsx                   # MRF list
│   │       │   ├── new/page.tsx               # Create MRF form
│   │       │   └── [id]/page.tsx              # MRF detail + approval
│   │       ├── candidates/
│   │       │   ├── page.tsx                   # Candidate list + grouping
│   │       │   └── [id]/page.tsx              # Candidate detail
│   │       ├── employees/page.tsx             # Employee list + add
│   │       ├── employee-portal/page.tsx       # Employee onboarding flow
│   │       ├── email/page.tsx                 # Email log + compose
│   │       ├── documents/page.tsx             # Document management
│   │       ├── reports/page.tsx               # Admin/HR reports (RSC)
│   │       ├── users/page.tsx                 # User management
│   │       ├── settings/page.tsx              # System settings (RSC)
│   │       └── org/
│   │           ├── countries/page.tsx         # Countries & branches tree
│   │           ├── departments/page.tsx       # Departments grid
│   │           └── designations/page.tsx      # Designations table
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                    # Dark sidebar with role-based nav
│   │   │   └── topbar.tsx                     # White topbar with page title
│   │   ├── providers.tsx                      # NextAuth SessionProvider wrapper
│   │   └── ui/                                # shadcn/ui components (Radix UI wrappers)
│   │       ├── badge.tsx, button.tsx, card.tsx, dialog.tsx
│   │       ├── input.tsx, label.tsx, select.tsx, table.tsx
│   │       ├── textarea.tsx, progress.tsx, separator.tsx
│   │       └── ... (accordion, avatar, checkbox, collapsible, dropdown-menu, etc.)
│   └── lib/
│       ├── auth.ts                            # NextAuth config (CredentialsProvider, JWT callbacks)
│       ├── prisma.ts                          # Prisma singleton with LibSQL adapter
│       └── utils.ts                           # cn(), formatDate(), CANDIDATE_STAGES, MRF_STATUSES, USER_ROLES
├── package.json
├── tsconfig.json
├── next.config.ts                             # Next.js config (Turbopack)
├── tailwind.config.ts / postcss.config.mjs   # Tailwind CSS v4 config
├── .env                                       # Environment variables (not committed)
└── PROJECT_CONTEXT.md                         # This document
```

---

## 11. Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database path for Prisma/LibSQL |
| `NEXTAUTH_SECRET` | Yes | `recruitpro-secret-key-change-in-production` | JWT signing secret |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | NextAuth base URL for callbacks |
| `SMTP_HOST` | No | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | Use TLS (`"true"` or `"false"`) |
| `SMTP_USER` | No | — | SMTP authentication username |
| `SMTP_PASS` | No | — | SMTP authentication password |
| `SMTP_FROM` | No | — | Sender email address |

> **Critical for production:** Change `NEXTAUTH_SECRET` to a strong random value. The default value is committed to source code.

---

## 12. Third-Party Integrations

### NextAuth.js (v4.24.14)
- Authentication provider: CredentialsProvider (email + password).
- JWT session strategy (no DB session table).
- Session callback extends JWT with `id` and `role` from DB user record.
- `authOptions` exported from `src/lib/auth.ts`; used via `getServerSession(authOptions)` in API routes and RSC pages.

### Nodemailer (v7.0.13)
- Used only in `POST /api/emails`.
- Transport created on each request from env vars.
- `sendMail()` wrapped in try/catch; SMTP failures are logged but do not block email DB record creation.
- If `SMTP_HOST` is not set, emails are stored in DB only (no actual delivery).

### Prisma (v7.8.0) + LibSQL Adapter
- `@prisma/adapter-libsql` wraps `@libsql/client` for SQLite access.
- **Singleton pattern in `src/lib/prisma.ts`:** `global.prisma` prevents multiple Prisma client instances in dev hot-reload.
- `createClient({ url: "file:./dev.db" })` for app; for scripts, use absolute path: `"file:" + path.resolve("./dev.db")`.
- Named export: `import { PrismaLibSql } from "@prisma/adapter-libsql"` (note: PrismaLibSql, not PrismaLibSQL).

### No external integrations:
- `aiScore` and `aiScoreNotes` on Candidate are manually set by HR (no AI API).
- No analytics, monitoring, payment, or CDN integrations.

---

## 13. Security Model

### Authentication
- JWT tokens stored in `next-auth.session-token` cookie (httpOnly, secure in production).
- `NEXTAUTH_SECRET` used for JWT signing — must be changed in production.
- Passwords hashed with bcryptjs, cost factor 10.
- `isActive` flag: inactive users cannot log in (checked in CredentialsProvider).

### Authorization
- Every API route calls `getServerSession(authOptions)` at the top; returns 401 if no session.
- Role checked against allowed roles array (e.g., `!["ADMIN", "HR"].includes(role)`); returns 403 if not allowed.
- CANDIDATE/EMPLOYEE: additional ownership check (userId → candidateId comparison).
- HR privilege restriction: cannot create/edit users with ADMIN role.

### Session Management
- JWT strategy — no server-side session storage.
- Session expires per NextAuth default (30 days idle).
- Sign-out calls `signOut()` which clears the cookie.

### Known Security Gaps (Not Fixed)
- `POST /api/org/divisions` and `POST /api/org/states` have **no auth check** — publicly writable.
- `POST /api/seed` and `POST /api/seed/extend-org` have **no auth check** — idempotent but callable by anyone.
- Files in `public/uploads/` are **publicly accessible** via URL without authentication.
- No CSRF protection beyond same-origin cookies (relying on Next.js/browser defaults).
- No rate limiting on login or API endpoints.
- Temp candidate passwords use `Math.random()` (not cryptographically secure).
- `NEXTAUTH_SECRET` defaults to a known committed value.

---

## 14. Deployment

### Build Process
```bash
npm install
npx prisma migrate deploy   # Apply all pending migrations (production-safe)
npx prisma generate         # Generate Prisma client from schema
npm run build               # Next.js production build
npm start                   # Start production server
```

### Development
```bash
npm install
npx prisma migrate dev      # Apply migrations + generate client (dev only)
npm run dev                 # Next.js dev server (Turbopack)
```

### Production Setup Checklist
1. Set `DATABASE_URL` to production SQLite path or libsql remote URL.
2. Set `NEXTAUTH_SECRET` to a strong random string (e.g., `openssl rand -base64 32`).
3. Set `NEXTAUTH_URL` to production domain (e.g., `https://recruitpro.example.com`).
4. Ensure `public/uploads/` is writable by the Node.js process.
5. For persistent file storage in containers: mount a volume at `public/uploads/`.
6. Call `POST /api/seed` once after first deployment to create initial data.
7. Call `POST /api/seed/extend-org` to populate full branch list.
8. Log in as admin and call `POST /api/seed/fix-org` for additional org fixtures.

### Hosting Requirements
- Node.js 18+ runtime.
- Writable filesystem for SQLite (`dev.db`) and uploads (`public/uploads/`).
- Single-instance deployment required (SQLite is not suitable for multi-instance without libsql remote/Turso).
- No serverless/Edge deployment (SQLite file requires persistent FS).

### CI/CD Notes
- Run `npx prisma migrate deploy` before application start in CI/CD pipelines.
- Run `npx prisma generate` after any schema change.
- No test suite configured (no Jest/Vitest/Playwright setup in the project).

---

## 15. Recreation Instructions

### Step 1: Scaffold the Project
```bash
npx create-next-app@16.2.7 recruitpro-erp --typescript --tailwind --app --src-dir --import-alias "@/*"
cd recruitpro-erp
```

### Step 2: Install Dependencies
```bash
npm install next-auth@^4.24.14 @auth/prisma-adapter prisma @prisma/client @prisma/adapter-libsql @libsql/client bcryptjs nodemailer
npm install lucide-react clsx tailwind-merge class-variance-authority
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-tabs @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-slot @radix-ui/react-toast
npm install -D @types/bcryptjs @types/nodemailer dotenv
```

### Step 3: Create `.env`
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-strong-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### Step 4: Set up Prisma
Create `prisma/schema.prisma` with all models as documented in Section 6.

Key schema directives:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
Run:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Step 5: Create `src/lib/prisma.ts`
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const libsql = createClient({ url: process.env.DATABASE_URL! });
const adapter = new PrismaLibSql(libsql);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Step 6: Create `src/lib/auth.ts`
- `CredentialsProvider` with email+password, Prisma lookup, bcrypt compare, `isActive` check.
- `jwt` callback: adds `token.id = user.id` and `token.role = user.role`.
- `session` callback: adds `session.user.id` and `session.user.role` from token.
- Extend TypeScript types for `Session` and `JWT` to include `id` and `role`.

### Step 7: Create `src/lib/utils.ts`
- `cn()` using `clsx` + `tailwind-merge`.
- `formatDate(date)` using `date-fns format`.
- `CANDIDATE_STAGES`: array of 15 `{ key, label, step }` objects in pipeline order.
- `MRF_STATUSES`: object mapping status keys to labels.
- `USER_ROLES`: array of role strings.

### Step 8: Create Root Structure
- `src/components/providers.tsx`: `SessionProvider` wrapper (client component).
- `src/app/layout.tsx`: HTML, body, Inter font, `<Providers>` wrapper.
- `src/app/page.tsx`: `getServerSession()` → `redirect("/dashboard")` or `redirect("/login")`.
- `src/app/globals.css`: Tailwind `@import "tailwindcss"`.

### Step 9: Create Dashboard Shell
- `src/components/layout/sidebar.tsx`: `navItems` array with roles filter, collapsible org menu, sign-out.
- `src/components/layout/topbar.tsx`: `pageTitles` map keyed by pathname, Bell icon, user avatar.
- `src/app/dashboard/layout.tsx`: `getServerSession()` → redirect if null; `flex h-screen` with `<Sidebar>` + `<main>` containing `<Topbar>` + content.

### Step 10: Create All shadcn/ui Components
Initialize or copy all components into `src/components/ui/`: button, card, dialog, input, label, select, table, badge, textarea, progress, separator, tabs, dropdown-menu, collapsible, etc.

### Step 11: Create API Routes (in order)
1. `/api/auth/[...nextauth]` — NextAuth handler
2. `/api/org/*` — all org routes (countries, divisions, states, branches, departments, designations)
3. `/api/users/*` — user management
4. `/api/mrfs/*` — MRF management + approval
5. `/api/candidates/*` — candidate management + stage
6. `/api/documents/*` — document upload/approval/delete
7. `/api/emails` — email send/list
8. `/api/employees/*` — employee management + onboarding step
9. `/api/seed*` — seed routes for initial data

### Step 12: Create All Dashboard Pages
Implement pages in this order:
1. `login/page.tsx` — quick access buttons + form
2. `dashboard/page.tsx` — role-adaptive RSC
3. `dashboard/mrfs/page.tsx` — client component
4. `dashboard/mrfs/new/page.tsx` — client component
5. `dashboard/mrfs/[id]/page.tsx` — client component
6. `dashboard/candidates/page.tsx` — client component with grouping
7. `dashboard/candidates/[id]/page.tsx` — client component
8. `dashboard/employees/page.tsx` — client component
9. `dashboard/employee-portal/page.tsx` — client component (3 steps)
10. `dashboard/email/page.tsx` — client component
11. `dashboard/documents/page.tsx` — client component
12. `dashboard/reports/page.tsx` — RSC
13. `dashboard/users/page.tsx` — client component
14. `dashboard/org/countries/page.tsx` — client component
15. `dashboard/org/departments/page.tsx` — client component
16. `dashboard/org/designations/page.tsx` — client component
17. `dashboard/settings/page.tsx` — RSC

### Step 13: Initial Data Seeding
```bash
# After npm run dev is running:
curl -X POST http://localhost:3000/api/seed
curl -X POST http://localhost:3000/api/seed/extend-org
# Then log in as admin and:
curl -X POST http://localhost:3000/api/seed/fix-org \
  -H "Cookie: next-auth.session-token=<your-session-token>"
```

---

## 16. Design Decisions

### Why Next.js App Router?
Single codebase for frontend and backend. RSC for auth-gated server-rendered pages (better security, no client flash). Route handlers as API. Tailwind CSS 4 works natively. No need for separate Express/Fastify server.

### Why SQLite + Prisma + LibSQL Adapter?
Zero-config database for development. LibSQL adapter required because `@prisma/client` with the standard SQLite driver (`better-sqlite3`) does not work well with Next.js Edge/Node hybrid environment. No PostgreSQL/MySQL needed at this scale. LibSQL also enables future migration to Turso (hosted SQLite) for production.

### Why NextAuth v4?
Mature, widely-used auth library for Next.js. CredentialsProvider fits the email+password requirement. JWT strategy avoids database session table overhead (no Session/Account tables needed for basic auth). Session extended with `id` and `role` to avoid extra DB queries per request.

### Why Local File Storage (`public/uploads/`)?
Simplest approach for demo/development. Files served as Next.js static assets. No S3/CDN configuration needed at this stage. Tradeoff: not suitable for multi-instance or serverless deployments; files are publicly accessible.

### Why shadcn/ui?
Pre-built, accessible Radix UI components with Tailwind styling. Consistent design system without a heavy component library (no Material UI bundle). CVA-based variant system. Components are owned/copied into the project — not a black-box dependency.

### Why No Global State Manager?
Each page is largely self-contained. Shared data (session) comes from NextAuth. Adding Redux/Zustand would add complexity without benefit at this scale. Each page component owns its data fetch lifecycle.

### Why Free-Text Strings for Employee dept/designation?
`Employee.department` and `Employee.designation` are stored as plain strings rather than FK relations to the Department/Designation models. This allows HR to enter custom labels when creating an employee record without being constrained to the exact seeded values.

### Tradeoffs Accepted
- SQLite not suitable for production at high concurrency (single write lock).
- No test suite — faster to ship, but no regression safety net.
- No optimistic UI updates — pages re-fetch after mutations (simpler code at cost of perceived latency).
- File storage in `public/` means all uploads are publicly accessible without auth.
- Some org API routes have no auth protection (convenience for form dropdowns).

---

## 17. Known Limitations

### Bugs / Issues
- `topbar.tsx` `pageTitles` map includes `/dashboard/my-application` (deleted page) — stale entry, causes no error but is dead code.
- `generateMRFNumber()` in `utils.ts` uses `Math.random()` — this function is NOT called anywhere; the async sequential version inside `src/app/api/mrfs/route.ts` is what actually runs. The exported utility is misleading.
- Employee code generation (`EMP-{count+1}`) can produce duplicate codes if employees are deleted (count-based, not max-based).

### Technical Debt
- `POST /api/org/divisions` and `POST /api/org/states` have no authentication — should require ADMIN.
- `POST /api/seed` and `POST /api/seed/extend-org` have no authentication.
- No server-side file type validation for uploads (client-side MIME type can be spoofed).
- No pagination on any list endpoint (could be slow at scale).
- No input length validation on text fields.

### Missing Features (Schema Exists, UI Does Not)
- `InterviewRecord` model: no API or UI to create/view interview records.
- `OfferDetail` model: no API or UI to create/view offer details.
- `UserCountryAssignment` model: schema exists for country-level user assignments but no UI.
- Email inbox: only sent emails are tracked; no received email functionality.
- Notification system: Bell icon in Topbar is decorative.
- No MRF re-submission after rejection.
- No password reset / forgot password flow.
- Employee onboarding form data (banking/emergency contact) is collected but NOT persisted — the form only advances the `onboardingStep` counter; the field values are discarded on submit.

### Performance Concerns
- All candidate list fetches include full nested relations — can be slow with large datasets.
- No cursor-based or offset pagination on any endpoint.
- `prisma.candidate.findMany()` with no limit or skip.
- SQLite concurrency is limited under high write load.

---

## 18. Exact Replication Guide

### User Journey 1: HR Creates an MRF and Tracks Full Approval

1. Log in as HR (hr@recruitpro.com / hr123).
2. Navigate to MRFs → New MRF.
3. Enter title "Software Engineer - Gandhidham".
4. Select Country: India → Division: South West Division → Branch: Gandhidham.
5. Select Department: Engineering, Designation: Senior Engineer, Vacancy Count: 2.
6. Select Vacancy Type: New Position. Check "New Role". Enter justification text.
7. Enter: Grade (B4), CTC Range (8-12 LPA), Location (Gandhidham), Reporting Manager (John Doe).
8. Enter qualifications (B.E./B.Tech), work experience (3-5 years).
9. Check "I confirm the contribution is justified" → Submit.
10. Redirected to `/dashboard/mrfs/{id}`. Status: "Pending Divisional Approval". MRF number: `MRF-2026-0001`.
11. Log out. Log in as Divisional Manager (dm@recruitpro.com / dm123).
12. Navigate to MRFs → Pending Approvals banner shows MRF-2026-0001.
13. Click View → approval timeline shows Step 1 (Divisional) active.
14. Click Approve → dialog opens with approverName pre-filled → click Confirm Approve.
15. Status advances to "Pending Functional Approval".
16. Log out. Log in as Admin (admin@recruitpro.com / admin123) to approve remaining levels (ADMIN overrides all levels).
17. Approve Functional and Country levels → status → "Approved", `approvedAt` set.

---

### User Journey 2: Full Candidate Lifecycle to Employee

1. Log in as HR.
2. Candidates → Add Candidate: First Name "Jane", Last Name "Doe", email "jane.doe@example.com", phone "9876543210", select MRF-2026-0001.
3. Candidate created at APPLIED stage. A User account is created (role=CANDIDATE, random temp password).
4. Click View on Jane Doe. Stage History shows "APPLIED (initial)".
5. Click "Advance Stage" → Select "Interview – Round 1" → Notes: "Phone screening passed" → Submit. Stage: INTERVIEW_1.
6. Click Edit → set `interviewDate` to tomorrow's date → Save.
7. On Candidates page, click INTERVIEW_1 filter → Jane Doe appears under tomorrow's date group.
8. Advance stage → INTERVIEW_2 → INTERVIEW_3 → PSYCHOMETRIC_TEST (skipped — Senior Engineer requires it, but assume mrf.designation.requiresPsychometric=true → must do it) → advance to SHORTLISTED.
9. Upload offer letter (HR uploads → auto-APPROVED) → advance to CTC_OFFERED → OFFER_LETTER → JOINED.
10. Navigate to Employees → Add Employee → select Jane Doe → enter: Joining Date, Dept "Engineering", Designation "Senior Engineer", CTC 1000000, Branch "Gandhidham" → Create.
11. Employee Code: EMP-0001 created.
12. Log out. Log in as employee (employee@recruitpro.com / emp123).
13. Redirected to `/dashboard/employee-portal`. Step 0 shown.
14. Click Upload Document → select a PDF → file uploaded to `/uploads/`. Documents list shows 1 file.
15. Click "Continue to Onboarding Form". `onboardingStep` advances to 1.
16. Fill all required fields (Emergency Contact, Phone, Bank Account, Bank Name, IFSC, PAN, Aadhaar) → click "Submit Form & View Dashboard".
17. `onboardingStep` advances to 2. Employee dashboard shown with details grid, pipeline tracker, documents.

---

### User Journey 3: Admin Manages Organisation

1. Log in as Admin.
2. Organization → Countries & Branches.
3. Click India card to expand → South West Division → Gujarat → see Gandhidham (GDM) branch chip.
4. Click trash icon on Gandhidham → browser `confirm()` dialog appears → Cancel → nothing happens.
5. Click trash icon on an empty branch (no users/MRFs) → Confirm → DELETE `/api/org/branches/{id}` → 200 → branch removed from UI.
6. Click trash icon on Gandhidham (has users/MRFs) → Confirm → API returns 409 "Cannot delete: 1 user(s) are assigned to this branch" → error alert shown.
7. Navigate to Departments → Add Department "Legal" → appears in grid.
8. Navigate to Designations → Add Designation "Legal Counsel", Dept "Legal", check requiresPsychometric=false → appears in table.

---

### User Journey 4: Candidate Views Own Pipeline

1. Log in as candidate (candidate@recruitpro.com / candidate123).
2. Redirected to `/dashboard`. Blue welcome banner shown.
3. Pipeline card shows 15 stages. Completed stages have green ✓ circles. Current stage is highlighted in blue. Future stages are gray.
4. If candidate has linked Employee record: green "You are now an employee" banner shown with EMP code, department, designation, joining date.

---

### Screen Behavior Reference

| Screen | URL Pattern | Auth Required | Key Roles |
|--------|-------------|--------------|-----------|
| Login | /login | No | All |
| Root | / | — | Redirect only |
| Dashboard | /dashboard | Yes | All (adaptive content) |
| MRF List | /dashboard/mrfs | Yes | All except CANDIDATE/EMPLOYEE |
| New MRF | /dashboard/mrfs/new | Yes | ADMIN, HR, BRANCH_MANAGER |
| MRF Detail | /dashboard/mrfs/{id} | Yes | All except CANDIDATE/EMPLOYEE |
| Candidates | /dashboard/candidates | Yes | ADMIN, HR |
| Candidate Detail | /dashboard/candidates/{id} | Yes | ADMIN, HR (full); CANDIDATE (own) |
| Employees | /dashboard/employees | Yes | ADMIN, HR |
| Employee Portal | /dashboard/employee-portal | Yes | EMPLOYEE |
| Email | /dashboard/email | Yes | ADMIN, HR |
| Documents | /dashboard/documents | Yes | ADMIN, HR |
| Reports | /dashboard/reports | Yes | ADMIN, HR |
| Users | /dashboard/users | Yes | ADMIN, HR |
| Countries | /dashboard/org/countries | Yes | ADMIN |
| Departments | /dashboard/org/departments | Yes | ADMIN |
| Designations | /dashboard/org/designations | Yes | ADMIN |
| Settings | /dashboard/settings | Yes | ADMIN |

---

### Expected Database State After Full Seed Sequence

After calling `POST /api/seed` → `POST /api/seed/extend-org` → `POST /api/seed/fix-org` (as admin):

**Countries (8):** India (locationType=INDIA), Australia, UAE, Oman, South Africa, Japan, Indonesia (locationType=OVERSEAS), Corporate (locationType=CORPORATE).

**India Divisions (2):** South West Division, East Central Division.

**South West Division States & Branches:**
- Gujarat → Gandhidham (GDM)
- Maharashtra → Mumbai (MUM)
- Rajasthan → Udaipur (UDI)
- Tamil Nadu → Chennai (CHN)
- Karnataka → Hospet (HSP)
- Goa → Goa (GOA)

**East Central Division States & Branches:**
- West Bengal → Kolkata (KOL)
- Odisha → Bhubaneswar (BBSR), Barbil (BBL), West Orissa (WOR)
- Andhra Pradesh → Vizag (VZG)
- Assam → Guwahati (GHY)
- Madhya Pradesh → Katni (KTN)
- Chhattisgarh → Raipur Lab (RPR-LAB)

**Corporate Direct Branches:** Kolkata HO (KOL-HO), Delhi HO (DEL-HO), Central Lab (CTRL-LAB), Udayayan Lab (UDYN-LAB).

**Demo Users:**
| Name | Email | Password | Role | Branch |
|------|-------|----------|------|--------|
| Admin User | admin@recruitpro.com | admin123 | ADMIN | — |
| HR User | hr@recruitpro.com | hr123 | HR | — |
| Branch Manager | bm@recruitpro.com | bm123 | BRANCH_MANAGER | Gandhidham |
| Divisional Manager | dm@recruitpro.com | dm123 | DIVISIONAL_MANAGER | — |
| Test Candidate | candidate@recruitpro.com | candidate123 | CANDIDATE | — |
| Test Employee | employee@recruitpro.com | emp123 | EMPLOYEE | — |

**Departments (8):** Operations, Finance, HR, Engineering, IT, Procurement, Safety, Marketing.

**Designations (8):**
| Title | Department | requiresPsychometric |
|-------|-----------|---------------------|
| Manager | Operations | true |
| Senior Engineer | Engineering | true |
| Engineer | Engineering | false |
| Analyst | Finance | false |
| HR Executive | HR | false |
| IT Specialist | IT | false |
| Procurement Officer | Procurement | false |
| Safety Officer | Safety | true |

---

## 19. Session Changes (2026-06-17)

### 19.1 MRF Mandatory Fields & Filler Tracking

**New mandatory fields on MRF creation:**
- `ctcRange` — CTC Range is now required (API returns 400 if missing).
- `fillerName` — Full name of the person raising the MRF.
- `fillerDesignation` — Designation of the person raising the MRF.

**New schema fields (MRF model):**
```
fillerName        String?
fillerDesignation String?
```

**UI changes (`src/app/dashboard/mrfs/new/page.tsx`):**
- CTC Range label changed to "CTC Range *".
- New "Raised By" card added with Full Name * and Designation * inputs.
- Submit button disabled until all three fields are filled.

**MRF Detail (`src/app/dashboard/mrfs/[id]/page.tsx`):**
- CTC Range and "Raised By" shown in the info grid on MRF detail.
- Approval dialog includes `approverDesignation` input (for ADMIN/HR recording external approvals).
- Approval timeline shows notes/remarks for each record.

**Approval record schema change (`MRFApprovalRecord` model):**
```
approverDesignation  String?
```

**API change (`src/app/api/mrfs/[id]/approve/route.ts`):**
- Accepts `approverDesignation` in body.
- Stores it in every `INSERT INTO MRFApprovalRecord` call via `prisma.$queryRawUnsafe`.

---

### 19.2 Corporate Branch Cleanup

- Removed "Delhi HO" branch (id `cmq0lkwxf000jwopc6auk7aqc`, code `DEL-HO`) from the database.
- Deletion was safe — no Users or MRFs referenced this branch.
- Corporate branches are under India's "Corporate" Division (id `cb70c9i4xhnyku72mzr7mu3y9`), NOT under a separate Corporate country entity.

---

### 19.3 Employee Type System (India / Overseas)

**New schema field (`Employee` model):**
```
employeeType  String  @default("INDIA")   // "INDIA" or "OVERSEAS"
```

**API change (`src/app/api/employees/[id]/route.ts`):**
- EMPLOYEE role PATCH now accepts both `onboardingStep` (Int) and `employeeType` ("INDIA" | "OVERSEAS").

**Employee Portal UI (`src/app/dashboard/employee-portal/page.tsx`):**
- Step 0 now starts with an Employee Category selection (India Employee / Overseas Employee) before document upload.
- After selecting type, it is persisted via PATCH and a mandatory document checklist is shown.
- **India checklist:** Aadhaar Card, PAN Card, Qualification Documents, Bank Details (all required).
- **Overseas checklist:** Passport/Government-Issued ID, Qualification Documents, Bank Details (all required).
- Each checklist item has an Upload button; uploaded docs are tagged with a `documentType` key (e.g. `AADHAAR`, `PAN`, `PASSPORT`, `BANK_DETAILS`, `QUALIFICATION`).
- Design is configurable: checklists are plain constants (`INDIA_CHECKLIST`, `OVERSEAS_CHECKLIST`) that can be extended without code changes to the upload logic.

---

### 19.4 Document Text Extraction (PDF Parsing)

**New package:** `pdf-parse` (installed via npm).

**New file (`src/lib/extract-document.ts`):**
- `extractDocumentData(filePath, mimeType, documentType)` — reads a PDF file and extracts key fields using regex patterns.
- Returns `Record<string, string> | null` (null for non-PDFs or unrecognised types).
- Supported document types and extracted fields:
  - `AADHAAR`: aadhaarNumber, name, dob
  - `PAN`: panNumber, name
  - `PASSPORT`: passportNumber, name, nationality, dob, expiryDate
  - `BANK_DETAILS`: accountNumber, ifsc, bankName
- Uses dynamic import (`const pdfParse = (await import("pdf-parse")).default`) to avoid Edge runtime issues.

**New schema field (`Document` model):**
```
extractedData  String?   // JSON string of extracted fields, or null
```

**Document upload API (`src/app/api/documents/route.ts`):**
- After saving the file, calls `extractDocumentData()` for extractable types.
- Stores result as JSON in `extractedData` field.
- Uses `prisma.$queryRawUnsafe()` for INSERT to include the new `extractedData` column (Prisma client cache is stale — does not know about this field without regeneration).
- Original file is never overwritten; extraction is additive.

---

### 19.5 HR Form Templates (Document Templates)

**New Prisma model (`DocumentTemplate`):**
```prisma
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
  uploadedBy   User     @relation("TemplateUploadedBy", fields: [uploadedById], references: [id])
}
```

**Template types:** `JOINING_FORM`, `DECLARATION_MSK`, `TIC_COUNSEL`, `OTHER`.

**New API routes:**
- `GET /api/document-templates` — Returns all active templates with uploader name (JOIN with User). No auth required (employees need to read this).
- `POST /api/document-templates` — Auth: ADMIN/HR. Accepts multipart form (file, name, templateType, description). Saves file to `public/uploads/templates/`. Inserts via `prisma.$queryRawUnsafe`.
- `DELETE /api/document-templates/[id]` — Auth: ADMIN/HR. Deletes physical file (best-effort) then DB record.
- `PATCH /api/document-templates/[id]` — Auth: ADMIN/HR. Updates name/description.

**New HR management page (`src/app/dashboard/document-templates/page.tsx`):**
- Card grid of templates with Download + Delete buttons.
- "Add Template" dialog: name, type dropdown, description, file upload.
- Visible to ADMIN and HR roles.
- Added to sidebar as "Form Templates" nav item.

**Employee Portal integration:**
- Below the document checklist, employees see a "HR Form Templates" section.
- Each template has a Download button (opens `fileUrl` in new tab).
- Employees download the blank template, fill it, and upload the completed version via the document checklist.

---

### 19.6 Candidate Email Autocomplete

**File changed:** `src/app/dashboard/candidates/page.tsx`

- On mount, fetches `/api/users` and stores the user list.
- In the Add Candidate dialog, the Email field now shows an autocomplete dropdown as the user types.
- Suggestions are filtered from the users list (`u.email.toLowerCase().includes(typed)`) — up to 6 results shown.
- Clicking a suggestion auto-fills: `email`, `firstName` (first word of user.name), `lastName` (remaining words).
- Dropdown dismisses on blur (with 150ms delay to allow click) or on selection.
- `autoComplete="off"` on the input to prevent browser native autocomplete conflicting.

---

### 19.7 Migration

Migration applied: `20260617054956_add_doc_templates_mrf_filler_employee_type`

Adds:
- `MRF.fillerName` (TEXT, nullable)
- `MRF.fillerDesignation` (TEXT, nullable)
- `MRFApprovalRecord.approverDesignation` (TEXT, nullable)
- `Document.extractedData` (TEXT, nullable)
- `Employee.employeeType` (TEXT, default "INDIA")
- `DocumentTemplate` table (full schema above)

---

### 19.8 Universal Manager (COUNTRY_MANAGER) Dashboard

**File changed:** `src/app/dashboard/page.tsx`

- "Total Candidates" stat card is hidden for COUNTRY_MANAGER role.
- "Candidates by Stage" chart is hidden for COUNTRY_MANAGER role.
- Dashboard grid adjusts to 3-column (instead of 4) for COUNTRY_MANAGER.
- "Recent MRFs" card spans 2 columns for COUNTRY_MANAGER to fill the space.

---

*End of PROJECT_CONTEXT.md*
