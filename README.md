# RecruitPro ERP

A full-featured recruitment management system built for enterprise HR workflows. Handles the full candidate lifecycle from MRF creation through onboarding, with a multi-level approval chain and role-based access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix UI) |
| Icons | Lucide React |
| ORM | Prisma 7 with `@prisma/adapter-libsql` |
| Database | SQLite (`dev.db`) via libsql |
| Auth | NextAuth v4 — JWT strategy, CredentialsProvider, bcryptjs |
| File Uploads | Node.js `fs/promises` → `public/uploads/` |
| Forms | React Hook Form + Zod |

### Key architectural notes

- **Prisma adapter** — this project uses the LibSQL adapter (`@prisma/adapter-libsql`), not the default `PrismaClient`. The client is instantiated with the adapter in `src/lib/prisma.ts`. Do not replace this with a bare `new PrismaClient()`.
- **App Router only** — all pages live under `src/app/`. There are no Pages Router files.
- **Server + Client components** — data-fetching pages are server components; interactive pages are `"use client"` components that fetch via the `/api` routes.

---

## Roles

| Role | Capabilities |
|---|---|
| `ADMIN` | Full access — users, MRFs, candidates, org structure, documents |
| `HR` | Manage users, MRFs, candidates, documents, record approvals |
| `BRANCH_MANAGER` | Create MRFs, view candidates |
| `DIVISIONAL_MANAGER` | Approve / reject divisional-level MRFs |
| `FUNCTIONAL_HEAD` | Approve / reject functional-level MRFs |
| `COUNTRY_MANAGER` | Approve / reject country-level MRFs |
| `CANDIDATE` | View own application, upload documents (pre-shortlist only) |

---

## MRF Approval Chain

```
PENDING_DIVISIONAL → PENDING_FUNCTIONAL → PENDING_COUNTRY → APPROVED
```

Each manager approves only their own level. The system auto-resolves the approver name from the logged-in session — no manual name entry required.

---

## Candidate Stages (10)

`APPLIED` → `AI_SCREENING` → `SHORTLISTED` → `INTERVIEW` → `PSYCHOMETRIC_TEST` → `OFFER` → `PROBATION` → `CHEMISTRY_TEST_TRAINING` → `CHEMISTRY_TEST` → `ONBOARDED`

Psychometric Test is skipped automatically for designations where it is not required.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

Run Prisma migrations to create the SQLite schema:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

### 4. Seed initial data

Start the dev server first, then POST to the seed endpoint:

```bash
npm run dev
# in another terminal:
curl -X POST http://localhost:3000/api/seed
```

This creates the org structure, an admin account, sample HR/branch manager users, a sample MRF, and a sample candidate.

**Default admin credentials after seed:**

| Field | Value |
|---|---|
| Email | `admin@recruitpro.com` |
| Password | `admin123` |

To add the full South West / East Central branch structure (Gandhidham, Mumbai, Udaipur, Chennai, Hospet, Goa, West Bengal, Bhubaneswar, etc.):

```bash
curl -X POST http://localhost:3000/api/seed/extend-org
```

Both seed endpoints are idempotent — safe to call multiple times.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The login page has **Quick Access** buttons for each role so you can switch accounts without typing credentials.

### Other commands

```bash
npm run build     # production build
npm run start     # run production build
npm run lint      # ESLint
npx prisma studio # visual DB browser at http://localhost:5555
```

---

## Project Structure

```
src/
  app/
    api/              # Route handlers (REST API)
      candidates/
      documents/
      mrfs/
      seed/
      users/
    dashboard/        # Protected app pages
      candidates/
      documents/
      mrfs/
      my-application/ # Candidate self-service
      settings/
      users/
    login/
  components/
    layout/           # Sidebar, header
    ui/               # shadcn/ui components
  lib/
    auth.ts           # NextAuth config
    prisma.ts         # Prisma client (LibSQL adapter)
    utils.ts          # Shared helpers, stage/status constants
prisma/
  schema.prisma
  migrations/
public/
  uploads/            # Uploaded candidate documents
```

---

## Document Upload

- HR/Admin can upload documents for any candidate at any stage (auto-approved).
- Candidates can upload their own documents only during `APPLIED` and `AI_SCREENING` stages (requires HR/Admin approval).
- Files are stored in `public/uploads/` with a timestamp-prefixed filename.
- HR/Admin can approve, reject, or delete any document from the candidate detail page.
