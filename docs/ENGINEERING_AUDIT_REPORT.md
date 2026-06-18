# RecruitPro ERP Engineering Audit Report

Audit date: 2026-06-17  
Audited scope: frontend, backend, database, authentication, authorization, APIs, state management, email, files, documents, MRF workflow, candidate workflow, onboarding, reporting, security, performance, deployment, scalability, and developer experience.

This audit is intentionally conservative. The application has useful recruitment workflow coverage, but it should be treated as an internal prototype/MVP until security, deployment, and data-governance issues are resolved.

## 1. Executive Summary

### Current Maturity

- Current maturity level: MVP/prototype with meaningful domain coverage.
- Overall project quality: promising feature breadth, weak production controls.
- Production readiness score: 35/100.
- Enterprise readiness score: 22/100.
- Maintainability score: 45/100.
- Security score: 25/100.
- Scalability score: 30/100.

### Key Findings

- The app has core recruitment primitives: users, roles, org structure, MRFs, approvals, candidates, stages, documents, onboarding data, notifications, email logs, reports, and templates.
- Production deployment is currently blocked by failed lint, a build-time Google Fonts fetch, SQLite/local-file assumptions, unresolved `.gitignore` conflict markers, public seed/mutation routes, and public file storage.
- Authentication exists, but authorization is inconsistent and route-local. Several endpoints are unauthenticated or under-authorized.
- Sensitive credentials exist in local `.env`; demo credentials are hardcoded in the login screen and seed routes. These must be rotated/removed before any deployment.
- The live SQLite database has schema fields not represented in `prisma/schema.prisma`, especially document versioning/category fields. This drift will break future Prisma-driven development.
- Uploaded documents are stored in `public/uploads`, directly web-accessible, not virus-scanned, not size-limited, and not access-controlled at the file layer.
- The workflow engine is hardcoded and string-based. It lacks SLA handling, delegation, audit trails, conditional approvals, rollback controls, and enterprise-grade approval semantics.
- Reporting is basic and has at least one incorrect status-count calculation.

### Production Recommendation

Do not deploy this application as-is to the public internet. The safest near-term path is a private staging deployment after critical endpoint lockdown, secret rotation, file-storage migration, database migration to PostgreSQL, and CI checks passing.

## 2. Architecture Review

### Stack Observed

- Next.js 16.2.7 App Router, React 19, TypeScript 5.
- NextAuth v4 with CredentialsProvider and JWT sessions.
- Prisma 7 with LibSQL adapter.
- SQLite database files: `dev.db` and `prisma/dev.db`.
- File uploads stored under `public/uploads`.
- Email through Nodemailer/SMTP if configured.
- UI is page-local client state with ad hoc `fetch` calls and some server components.

### Project Structure

Strengths:

- Clear top-level structure: `src/app`, `src/components`, `src/lib`, `prisma`, `public`, `docs`.
- Domain routes are discoverable: `api/mrfs`, `api/candidates`, `api/documents`, `api/employees`, `api/org`, `api/users`.
- UI primitives are separated under `src/components/ui`.

Weaknesses:

- Business logic is embedded directly in API route handlers and page components.
- No service layer for MRF workflow, candidate workflow, document management, onboarding, or email delivery.
- Authorization checks are repeated manually and inconsistently.
- Many large client pages exceed healthy component boundaries, especially:
  - `src/app/dashboard/employee-portal/page.tsx`
  - `src/app/dashboard/mrfs/new/page.tsx`
  - `src/app/dashboard/candidates/page.tsx`
  - `src/app/dashboard/candidates/[id]/page.tsx`
  - `src/app/dashboard/employees/page.tsx`
- Workflow statuses and roles are string literals spread across schema, routes, utilities, and UI.
- Raw SQL is used heavily through `$queryRawUnsafe`, sometimes to work around Prisma schema/client drift.
- No shared API client, no shared error model, no request validation boundary, and no shared RBAC policy module.

### Anti-Patterns

- Route handlers combine auth, validation, business rules, persistence, notifications, and email.
- Mass assignment patterns:
  - `PATCH /api/mrfs/[id]` updates using `data: body`.
  - `PATCH /api/employees/[id]` lets Admin/HR update arbitrary fields from request body.
  - `PATCH /api/candidates/[id]` passes most body fields directly into Prisma update.
- Public mutable endpoints:
  - `POST /api/seed`
  - `POST /api/seed/setup-v2`
  - `POST /api/seed/extend-org`
  - `POST /api/org/divisions`
  - `POST /api/org/states`
- User-facing demo login credentials hardcoded in `src/app/login/page.tsx`.
- Local public filesystem is treated as document storage.
- Seed/demo behavior is mixed into production route tree.
- No transaction boundaries around multi-step business changes such as MRF approval plus approval record plus notifications.

### Recommendations

- Create domain service modules:
  - `src/server/services/mrf-service.ts`
  - `src/server/services/candidate-service.ts`
  - `src/server/services/document-service.ts`
  - `src/server/services/email-service.ts`
  - `src/server/services/onboarding-service.ts`
- Create shared security modules:
  - `requireSession()`
  - `requireRole([...])`
  - `canAccessCandidate(user, candidate)`
  - `canAccessMRF(user, mrf)`
  - `canMutateOrg(user)`
- Replace route-local role checks with a single RBAC/ABAC policy layer.
- Replace string roles/statuses with enums or constants generated from schema.
- Add Zod request schemas for every POST/PATCH route.
- Refactor large pages into workflow sections and hooks.
- Remove seed/setup routes from production bundles or guard them behind environment and admin checks.

## 3. Deployment Readiness

### Can It Be Deployed Today?

Technically, a local demo can run. It is not ready for production deployment.

Observed blockers:

- `npm.cmd run lint` fails with 95 errors and 30 warnings.
- `npm.cmd run build` fails because `next/font/google` attempts to fetch Inter from Google Fonts at build time and the environment cannot reach it.
- `.gitignore` contains unresolved merge-conflict markers.
- `dev.db`, `prisma/dev.db`, and at least one uploaded file are tracked by git.
- Production data storage depends on mutable local disk.
- SQLite is not suitable for multi-user enterprise production workflows.
- Public mutable seed/org routes exist.
- Secrets and demo credentials are present locally/source-side.
- No CI, test suite, health checks, observability, backup plan, or migration strategy is evident.

### Hosting Recommendation

Vercel:

- Good fit for the Next.js frontend and stateless API routes.
- Poor fit for current architecture because file uploads depend on local disk and SQLite.
- Could become appropriate after moving files to object storage and database to managed PostgreSQL/Neon/Supabase/RDS.

Railway/Render/Fly.io:

- Better for a quick staging environment because they can host a full Node server and managed PostgreSQL.
- Still require external object storage for documents.

AWS/Azure/DigitalOcean:

- Best for enterprise roadmap if the product must support compliance controls, private networking, object storage, managed database, backups, SIEM integration, and audit retention.
- Recommended long-term target: AWS ECS/Fargate or App Runner + RDS PostgreSQL + S3 + CloudFront signed URLs + SES + Secrets Manager + CloudWatch/OpenTelemetry.

VPS:

- Acceptable only for a private pilot.
- Not recommended for enterprise because backup, patching, monitoring, security hardening, and disaster recovery become operational liabilities.

### Deployment Roadmap

1. Remove or lock down seed routes and unauthenticated org mutation routes.
2. Rotate all secrets and remove demo credentials from source.
3. Fix `.gitignore`, untrack DB/upload artifacts, and add `.claude/**` to ESLint ignores.
4. Make lint and build pass.
5. Replace `next/font/google` with a local font or a deployment-safe font strategy.
6. Move database to PostgreSQL and run Prisma migrations from a clean schema.
7. Move uploads/templates/forms to private object storage.
8. Add environment validation and secret management.
9. Add CI: typecheck, lint, tests, build, migration check.
10. Add health/readiness endpoints and logging/monitoring.

## 4. Database Review

### Schema Strengths

- Core entities are represented: User, MRF, Candidate, Document, Employee, Email, Notification, WorkflowStage, org hierarchy.
- Useful uniqueness constraints exist on email, candidate-user relation, MRF number, employee code, stage key, country code/name, branch code.
- Initial indexing was added for candidate stage, document candidate/type/status, and MRF approval record lookup.

### Schema Risks

- SQLite limits concurrency and production scalability.
- `schema.prisma` does not include live DB columns `Document.version`, `Document.replacesDocumentId`, `Document.parseStatus`, and `Document.category`.
- Most domain statuses and roles are free-form strings.
- Many tables lack indexes for common filters/joins:
  - `MRF.status`
  - `MRF.countryId`
  - `MRF.departmentId`
  - `MRF.createdById`
  - `Candidate.mrfId`
  - `Candidate.createdAt`
  - `CandidateStageHistory.candidateId`
  - `Document.uploadedById`
  - `Document.mrfId`
  - `Employee.branchId`
  - `Email.fromId`
  - `Email.candidateId`
  - `Email.mrfId`
  - `Notification.userId`
  - `Notification.isRead`
  - `InterviewRecord.candidateId`
  - `InterviewRecord.interviewerId`
  - `InterviewRecord.scheduledAt`
- Onboarding form data is stored as a stringified JSON blob. This blocks querying, validation, partial updates, auditing, and reporting.
- Employee stores department/designation as strings instead of foreign keys, causing denormalization and drift.
- No tenant/company model exists.
- No audit table for sensitive domain events.
- No soft-delete/deactivation strategy for candidate, document, MRF, and employee lifecycle records.
- No immutable history for document rejection/deletion.
- No background job model for email, parsing, notifications, or AI tasks.

### Recommended Schema Improvements

- Move to PostgreSQL.
- Add Prisma enums for roles, MRF statuses, candidate stages, document types, approval statuses, employee types, notification types, email delivery states.
- Reconcile migrations and `schema.prisma`.
- Add an `AuditLog` table:
  - actorId
  - entityType
  - entityId
  - action
  - beforeJson
  - afterJson
  - ipAddress
  - userAgent
  - createdAt
- Add `DocumentVersion` or properly use document version fields.
- Add `FileObject` table with object key, bucket, checksum, MIME, size, AV status, retention category, access policy.
- Add `EmailDelivery` table or extend Email with provider message id, delivery status, failure reason, retries, opened/clicked events if required.
- Add normalized onboarding tables for high-value fields, while keeping raw JSON snapshots for form preservation.
- Add SLA and assignment fields to workflow records.
- Add tenant/company boundaries before enterprise use.

## 5. Security Audit

### Critical

1. Public seed/setup endpoints mutate data and expose/demo credentials.
   - Affected: `src/app/api/seed/route.ts`, `src/app/api/seed/setup-v2/route.ts`, `src/app/api/seed/extend-org/route.ts`.
   - Impact: unauthorized database mutation, demo credential creation, environment poisoning.

2. Public org mutation endpoints.
   - Affected: `src/app/api/org/divisions/route.ts`, `src/app/api/org/states/route.ts`.
   - Impact: unauthenticated attackers can create org hierarchy records.

3. Secrets and demo credentials.
   - Affected: `.env`, `src/app/login/page.tsx`, seed routes, README.
   - Impact: account compromise and email account compromise. Rotate all exposed secrets before deployment.

4. Public document storage.
   - Affected: `public/uploads`, `public/forms`, document routes.
   - Impact: sensitive candidate/employee documents can be accessed by URL without authorization.

5. Real DB/upload artifacts tracked.
   - Affected: `dev.db`, `prisma/dev.db`, `public/uploads/...`.
   - Impact: candidate/employee PII may leak through repository history.

### High

- Inconsistent API authorization:
  - `GET /api/mrfs` returns broad MRF data to any authenticated user.
  - `GET /api/mrfs/[id]` returns broad MRF detail to any authenticated user.
  - `GET /api/candidates/[id]` blocks only non-owner candidates, but other authenticated roles may access candidate details.
  - several org GET routes are public.
- No brute-force/rate limiting on credentials login.
- No MFA or SSO.
- No password policy beyond minimal UI hints; APIs do not consistently enforce password strength.
- Mass assignment on MRF, employee, and candidate updates.
- File uploads have no allowlist, max size, checksum, AV scanning, malware sandboxing, content disarm, or signed download.
- SMTP failure is swallowed; users may believe email was sent.
- Raw SQL through `$queryRawUnsafe` is widespread.
- No CSRF/origin strategy documented for mutation APIs.
- No audit trail for privileged changes.

### Medium

- JWT sessions do not refresh role/isActive changes until token refresh/sign-in.
- No security headers/CSP documented in `next.config.ts`.
- No privacy consent tracking for candidate documents and sensitive onboarding data.
- No data retention/deletion workflow.
- No field-level masking for sensitive documents/PII.
- No structured logging, anomaly detection, or SIEM export.
- No environment validation on startup.

### Low

- Some errors return raw exception messages.
- Demo language and quick-access UX are present in production-facing login code.
- Inconsistent 401/403 behavior.

## 6. Email System Review

### Current Implementation

- Nodemailer sends via SMTP if `SMTP_HOST` exists.
- Email sends are synchronous from route handlers.
- Failures are logged but not surfaced.
- Sent emails are always inserted into the database even if SMTP delivery fails.
- No templates, delivery status, retries, provider IDs, queue, bounce handling, DKIM/SPF/DMARC checks, or consent/preference management.

### Is SMTP the Right Choice?

SMTP is acceptable for a prototype. It is not the best enterprise architecture for recruitment-critical workflows.

### Gmail OAuth / Manager Gmail Accounts

- Do not use shared Gmail app passwords.
- Do not let every manager connect personal Gmail as the primary architecture. It creates consent, token storage, offboarding, audit, data retention, and brand consistency problems.
- Gmail OAuth can be offered later as an optional integration for calendar/interview scheduling or individual sending, but it should not be the core system mail channel.

### Outlook Support

Yes, add Microsoft 365/Graph support for enterprise customers, especially calendar scheduling and interview invites.

### Recommended Enterprise Architecture

- Use a dedicated provider for transactional/system email: AWS SES, SendGrid, Mailgun, Postmark, or Resend.
- Use domain-authenticated sending with SPF, DKIM, DMARC.
- Send via a background job queue.
- Store delivery state and provider message IDs.
- Add templates with variables and approval/versioning.
- Add Microsoft Graph/Google Calendar integrations for interviews.
- Add audit logging for every outbound email.

## 7. Document Management Audit

### Current State

- Uploads go to `public/uploads`.
- Document templates go to `public/uploads/templates`.
- Static forms are in `public/forms`.
- Extracted data is stored as JSON text on `Document`.
- Candidate/employee uploads are stage/role constrained in API, but file URLs are public.
- Rejected documents are deleted physically and logically.

### Gaps

- No private storage.
- No virus scanning.
- No document retention policy.
- No signed URLs.
- No folder/category hierarchy by candidate/MRF/employee.
- No full version history exposed in Prisma schema or routes.
- No immutable audit trail.
- No OCR for scanned images.
- No search index.
- No document classification pipeline.
- No checksum/deduplication.
- No access logs.
- No legal hold.
- No masking/redaction for Aadhaar, PAN, passport, bank data.

### Recommendations

- Create a document center with:
  - candidate file
  - employee file
  - MRF approvals
  - offer/appointment letters
  - statutory forms
  - confidential documents
- Store files in S3/Azure Blob/GCS with private ACLs.
- Serve downloads through signed URLs after authorization.
- Add document versioning and replacement flows.
- Retain rejected records with status and reason instead of deleting evidence.
- Add OCR/parsing jobs for PDF/images.
- Add a searchable metadata index.
- Add document-level audit trail and access logs.
- Add field-level redaction/masking for national IDs and bank data.

## 8. Recruitment Workflow Audit

### Current MRF Workflow

- MRF creation captures many useful fields.
- Approval flow is hardcoded:
  - PENDING_DIVISIONAL
  - PENDING_FUNCTIONAL
  - PENDING_COUNTRY
  - APPROVED
- Country manager can act as a universal approver.
- Approval records exist.
- Notifications and email are attempted.

Gaps:

- No dynamic approval matrix by country, branch, department, grade, budget, salary band, vacancy type, or replacement/new role.
- No delegation/out-of-office handling.
- No SLA/escalation.
- No parallel approval.
- No approval comments attachments except limited document relation.
- No immutable approval audit.
- No budget/headcount control integration.
- No MRF cancellation/hold/reopen lifecycle beyond rejected restart.
- MRF number generation can race under concurrency.

### Current Candidate Workflow

- Candidates have stage history.
- Stages are configurable through WorkflowStage.
- Candidate records can link to MRFs and documents.

Gaps:

- No job posting/career site.
- No resume ingestion pipeline.
- No source tracking.
- No candidate duplicate detection.
- No recruiter ownership.
- No hiring manager feedback workflow.
- No structured interview scorecards.
- No calendar scheduling.
- No interview panel availability.
- No assessments integration.
- No background verification.
- No offer approval workflow.
- No e-signature.
- No candidate communication timeline.
- No GDPR/consent model.

### Current Onboarding Workflow

- Employee records can be created from joined candidates.
- Employee portal captures onboarding form data and documents.
- Some document extraction exists.

Gaps:

- No task checklist by role/country/employee type.
- No due dates, owners, escalations, or completion evidence.
- No payroll/IT/facilities handoffs.
- No statutory validation.
- No e-signature.
- No onboarding packet generation with versioned templates.
- No employee master-data approval before HRIS handoff.

### Prioritized Feature List

1. Approval matrix and RBAC hardening.
2. Candidate ownership, source tracking, duplicate detection.
3. Structured interview scheduling and feedback.
4. Offer generation, approval, and e-signature.
5. Document center with private storage and audit trail.
6. Onboarding task engine by employee type/country.
7. Recruitment analytics by funnel, source, SLA, recruiter, department.
8. External career site/job posting.
9. Candidate communication timeline.
10. AI parsing/ranking/summarization.

## 9. UX/UI Audit

### Strengths

- Main workflows are reachable from the dashboard.
- UI uses consistent components and icons.
- Empty/loading states exist in many pages.
- Candidate, MRF, employee, reports, documents, users, and settings screens are present.

### Issues

- Login exposes quick-access demo accounts.
- Workflows rely on browser `alert`/`confirm` in several places.
- No global toast/error boundary pattern.
- No shared loading/error UX.
- Large forms are long and state-heavy.
- MRF creation should be a stepper/wizard with autosave.
- Employee onboarding portal is too long for a single page.
- Candidate detail mixes profile editing, stage movement, documents, and interview notes.
- Document management lacks preview, filters by candidate/MRF/type/category, bulk actions, and version history.
- Reports are static and not filterable by time period, geography, department, recruiter, source, or stage.
- Mobile behavior has not been verified.
- Some text encoding appears corrupted in UI strings (`â€”`, bullets), likely from encoding issues.
- Page-local data fetching creates inconsistent errors and repeated loading patterns.

### Redesign Recommendations

- Build workflow-specific layouts:
  - MRF wizard
  - Candidate profile tabs
  - Document center
  - Onboarding checklist
  - Approval inbox
  - Reporting workspace
- Add autosave for long forms.
- Add consistent toasts and inline validation.
- Add command/search for candidates, MRFs, and employees.
- Add role-aware dashboards.
- Add table pagination, sorting, saved filters, and CSV export.
- Add mobile-responsive validation pass.

## 10. Performance Audit

### Backend

- Many list APIs return all records without pagination.
- Includes can become heavy as data grows.
- Missing indexes will slow list/report screens.
- MRF number and employee code generation are count/last-row based and race-prone.
- Notifications poll every 30 seconds from every active dashboard session.
- Synchronous file parsing/email sending occurs in request lifecycle.
- Raw SQL and Prisma are mixed, creating inconsistent query behavior.

### Frontend

- Heavy client pages increase bundle size.
- No data-cache layer such as React Query/SWR.
- Repeated fetches across pages.
- No virtualization for large candidate/document/employee lists.
- Dynamic Tailwind class names in reports may not compile reliably.
- Build currently depends on external font fetch.

### Recommendations

- Add pagination and server-side filtering everywhere.
- Add indexes listed in the database section.
- Use background jobs for email, document parsing, OCR, and AI.
- Add React Query/SWR for client data.
- Split large pages into lazy-loaded sections.
- Use WebSockets/SSE or smarter polling for notifications.
- Replace local generation with DB-backed sequences/counters.
- Add performance budgets and bundle analysis.

## 11. AI Feature Opportunities

| Feature | Impact | Complexity | ROI | Notes |
|---|---:|---:|---:|---|
| Resume parsing | High | Medium | Very high | Extract candidate profile, skills, education, experience. |
| Candidate-MRF matching | High | Medium | High | Rank and explain fit against job profile. |
| Interview summarization | High | Medium | High | Convert notes/transcripts into structured scorecards. |
| MRF generation assistant | Medium | Low | High | Draft job profile, qualifications, CTC rationale. |
| Document extraction | High | Medium | High | Aadhaar/PAN/passport/bank/statutory fields with confidence scores. |
| Offer letter generation | High | Medium | High | Template-based generation with approvals and e-sign. |
| Hiring analytics assistant | Medium | Medium | Medium | Natural-language funnel, SLA, source, recruiter insights. |
| Candidate communication assistant | Medium | Low | Medium | Draft emails, interview invitations, rejection notices. |
| Duplicate candidate detection | High | Low | High | Match email, phone, resume fingerprints. |
| Onboarding form autofill | Medium | Medium | Medium | Use extracted docs to prefill employee onboarding. |

AI should be introduced only after access controls, audit logging, consent, and data retention are fixed.

## 12. Enterprise Feature Gap Analysis

Official/public product positioning from SAP, Oracle, and Zoho emphasizes AI, automation, candidate engagement, CRM/talent pools, job distribution, interview scheduling, offers, onboarding, integrations, and analytics. SAP describes AI-first recruiting with candidate relationship management, automated screening, interview scheduling, and digital offer management. Oracle lists branded career sites, AI job descriptions, candidate recommendations, embedded CRM, interview self-scheduling, onboarding journeys, real-time analytics, LinkedIn/direct-apply integrations, resume extraction, two-way messaging, and centralized interview management. Zoho Recruit highlights AI assistance, job-board publishing, automations, portals, integrations, candidate pipeline management, parsing, scheduling, offer letters, and advanced hiring metrics.

Sources:

- SAP SuccessFactors/SmartRecruiters: https://www.sap.com/products/hcm/recruiting-software.html
- Oracle Recruiting: https://www.oracle.com/human-capital-management/recruiting/
- Zoho Recruit: https://www.zoho.com/recruit/

### Missing Compared With Enterprise Suites

- Career site and job posting distribution.
- Recruitment marketing and talent CRM.
- Talent pools and passive candidate campaigns.
- Job requisition templates and workforce planning integration.
- Dynamic approval matrix.
- Budget/headcount controls.
- Internal mobility.
- Candidate self-service applications without admin-created account.
- Resume parsing and profile autofill.
- Candidate matching/ranking with explainability.
- Interview scheduling with calendars.
- Interview scorecards and feedback calibration.
- Offer approval and e-signature.
- Background checks and assessment integrations.
- Onboarding journeys/tasks.
- HRIS/payroll integrations.
- Configurable automations/workflows.
- Advanced analytics and predictive metrics.
- Mobile-first candidate/manager experience.
- Compliance, consent, retention, audit, and access governance.
- Marketplace/API/webhooks.

## 13. Technical Debt Register

| Issue | Severity | Impact | Effort | Recommendation |
|---|---|---|---|---|
| Public seed/setup mutation endpoints | Critical | Unauthorized DB mutation | S | Remove or admin/env-gate |
| Unauthenticated org POST routes | Critical | Data poisoning | S | Add auth/RBAC |
| Public document URLs | Critical | PII leakage | M | Move to private object storage |
| Secrets in local `.env` and demo credentials in source | Critical | Account compromise | S | Rotate secrets, remove demos |
| Tracked DB/upload files | Critical | PII leakage | M | Untrack and purge history if shared |
| Inconsistent route authorization | High | Unauthorized data access | M | Central RBAC/ABAC |
| Schema drift between DB and Prisma | High | Runtime/dev breakage | M | Reconcile schema/migrations |
| Lint fails | High | CI/deploy blocker | M | Fix lint and ignores |
| Build depends on Google Fonts fetch | High | Deploy blocker | S | Use local font |
| SQLite database | High | Scalability/concurrency limit | L | Migrate to PostgreSQL |
| No validation schemas | High | Bad data/security risk | M | Zod route schemas |
| Mass assignment | High | Privilege/data tampering | M | Allowlist update fields |
| Raw SQL unsafe usage | Medium | Injection/maintenance risk | M | Use Prisma or typed raw SQL |
| No audit trail | High | Compliance gap | L | Add AuditLog |
| Email delivery is not reliable | Medium | Business process confusion | M | Queue/provider/status |
| No file scanning | High | Malware risk | M | AV pipeline |
| No pagination | Medium | Performance degradation | M | Paginated APIs |
| Large client pages | Medium | Maintainability/performance | M | Split components/hooks |
| No tests | High | Regression risk | L | Add unit/integration/e2e |
| No CI/CD | High | Release risk | M | Add pipeline |
| Onboarding data as JSON string only | Medium | Reporting/compliance limitation | M | Normalize key fields |
| Hardcoded workflow | Medium | Enterprise inflexibility | L | Workflow engine/matrix |
| Wrong report pending status calculation | Medium | Misleading analytics | S | Count each status |
| No MFA/SSO | High | Enterprise security gap | L | Add OIDC/SAML |
| No rate limiting | High | Brute-force risk | S | Add limiter/WAF |

## 14. Roadmap

### Phase 1: Critical Fixes

| Item | Priority | Effort | Dependencies | Benefit |
|---|---|---:|---|---|
| Disable/remove public seed routes | P0 | S | None | Stops unauthenticated mutation |
| Secure org mutation routes | P0 | S | RBAC helper | Stops data poisoning |
| Rotate secrets and remove quick-login credentials | P0 | S | Secret manager | Reduces compromise risk |
| Move files out of public URLs | P0 | M | Object storage | Protects PII |
| Fix `.gitignore`, untrack DB/uploads | P0 | M | Repo cleanup | Prevents data leakage |
| Add route validation and field allowlists | P0 | M | Zod schemas | Prevents malformed/mass assignment |
| Add centralized auth/RBAC helpers | P0 | M | Role policy design | Consistent access control |

### Phase 2: Production Readiness

| Item | Priority | Effort | Dependencies | Benefit |
|---|---|---:|---|---|
| Make lint/build pass | P1 | M | Phase 1 cleanup | CI/deployment ready |
| Replace Google font build fetch | P1 | S | Font asset | Reliable builds |
| Migrate SQLite to PostgreSQL | P1 | L | Schema reconciliation | Concurrency/scalability |
| Reconcile Prisma schema and migrations | P1 | M | DB review | Stable development |
| Add CI/CD pipeline | P1 | M | Passing checks | Safer releases |
| Add health checks/logging | P1 | M | Deployment target | Operability |
| Add pagination/filtering | P1 | M | API refactor | Performance |

### Phase 3: Enterprise Readiness

| Item | Priority | Effort | Dependencies | Benefit |
|---|---|---:|---|---|
| Add audit logging | P1 | L | Auth/RBAC | Compliance |
| Add SSO/MFA | P1 | L | Identity provider | Enterprise security |
| Add approval matrix | P1 | L | Workflow design | Real org fit |
| Add document retention/legal hold | P2 | M | Document center | Compliance |
| Add email provider/queue | P2 | M | Job system | Reliable messaging |
| Add interview scheduling/scorecards | P2 | L | Calendar integration | Better hiring decisions |
| Add offer approval/e-sign | P2 | L | Templates/document center | Complete hiring lifecycle |

### Phase 4: Advanced Features

| Item | Priority | Effort | Dependencies | Benefit |
|---|---|---:|---|---|
| Career site/job posting | P2 | L | Candidate application model | Candidate acquisition |
| Talent pools/CRM | P2 | L | Candidate source model | Strategic recruiting |
| Advanced reporting | P2 | M | PostgreSQL/indexing | Management visibility |
| Onboarding task engine | P2 | L | Employee workflow model | Operational completion |
| Integrations/webhooks | P3 | L | API/versioning | Ecosystem readiness |

### Phase 5: AI-Powered Enhancements

| Item | Priority | Effort | Dependencies | Benefit |
|---|---|---:|---|---|
| Resume parser | P2 | M | Document security | Faster candidate creation |
| Candidate ranking | P2 | M | Profile/job normalization | Better shortlist quality |
| Document extraction | P2 | M | OCR/storage | Faster onboarding |
| Interview summarization | P3 | M | Scorecards | Better feedback quality |
| MRF assistant | P3 | S | Job profile templates | Faster requisitions |
| Analytics assistant | P3 | M | Analytics warehouse | Executive insights |

## 15. CLAUDE IMPLEMENTATION PACKAGE

The following tasks are ordered for another AI engineer to implement safely.

### Task 1: Lock Down Seed and Setup Routes

Objective: prevent unauthenticated mutation and credential disclosure.  
Files likely affected: `src/app/api/seed/*`, `README.md`, route tree.  
Database changes: none.  
API changes: remove production availability or require ADMIN plus `ALLOW_SEED_ROUTES=true`.  
Frontend changes: none.  
Acceptance criteria:

- Public requests to seed/setup endpoints return 404 or 403 in production.
- Seed route no longer returns plaintext credentials.
- README clearly marks seed credentials as local-only.

### Task 2: Add Central Authorization Utilities

Objective: create consistent session and role enforcement.  
Files likely affected: `src/lib/auth.ts`, new `src/server/authz.ts`, all API routes.  
Database changes: none.  
API changes: all protected routes use shared helpers.  
Frontend changes: handle consistent 401/403 responses.  
Acceptance criteria:

- Every mutation route requires authenticated role checks.
- Candidate/employee users can access only their own records.
- Manager access is scoped by role, branch, country, department, or explicit policy.

### Task 3: Secure Org Routes

Objective: fix unauthenticated org mutation.  
Files likely affected: `src/app/api/org/divisions/route.ts`, `src/app/api/org/states/route.ts`, org route files.  
Database changes: none.  
API changes: POST/PATCH/DELETE require ADMIN, or HR where intended.  
Frontend changes: surface permission errors.  
Acceptance criteria:

- Anonymous POST to org routes is rejected.
- Non-admin mutation attempts are rejected.
- Existing org management UI still works for authorized roles.

### Task 4: Remove Demo Login From Production

Objective: eliminate hardcoded credentials and unsafe demo UX.  
Files likely affected: `src/app/login/page.tsx`, seed routes, README.  
Database changes: none.  
API changes: none.  
Frontend changes: quick-access panel hidden unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`.  
Acceptance criteria:

- Production login page has no demo buttons.
- Demo credentials are not embedded in production JS.
- Admin seed password is generated or supplied through env.

### Task 5: Rotate and Validate Secrets

Objective: remove exposed/weak secrets and enforce env correctness.  
Files likely affected: `.env.example`, new `src/lib/env.ts`, deployment config.  
Database changes: none.  
API changes: startup fails if required env is missing.  
Frontend changes: none.  
Acceptance criteria:

- Real SMTP app password and NEXTAUTH_SECRET are rotated.
- `.env.example` contains placeholders only.
- App validates required env vars at startup.

### Task 6: Private File Storage

Objective: stop serving documents from public disk.  
Files likely affected: `src/app/api/documents/*`, `src/app/api/document-templates/*`, document UI pages, new storage service.  
Database changes: add file object key/checksum/storage provider fields.  
API changes: uploads return document metadata; downloads use authorized signed URL endpoint.  
Frontend changes: use download endpoint instead of direct `fileUrl`.  
Acceptance criteria:

- Uploaded files are not accessible through `/uploads/...`.
- Download requires authorization.
- File size/MIME allowlist is enforced.
- Existing documents can be migrated or flagged.

### Task 7: Add File Security Pipeline

Objective: add upload validation, malware scanning, and document metadata.  
Files likely affected: document service/routes.  
Database changes: add `scanStatus`, `scanResult`, `checksum`, `storageKey`.  
API changes: upload can return pending scan status.  
Frontend changes: show scan/parse status.  
Acceptance criteria:

- Oversized/disallowed files are rejected.
- Files are scanned before approval/download.
- Scan failures are visible to HR/Admin.

### Task 8: Reconcile Prisma Schema and Migrations

Objective: eliminate schema drift.  
Files likely affected: `prisma/schema.prisma`, migrations.  
Database changes: migration or baseline reset for target environment.  
API changes: remove raw SQL workarounds where possible.  
Frontend changes: none.  
Acceptance criteria:

- `prisma/schema.prisma` includes all live columns.
- `npx prisma migrate deploy` works on a clean DB.
- Prisma Client exposes document version/category fields.

### Task 9: Move to PostgreSQL

Objective: prepare for concurrent production use.  
Files likely affected: `prisma/schema.prisma`, `src/lib/prisma.ts`, deployment env.  
Database changes: SQLite to PostgreSQL migration.  
API changes: no behavioral changes expected.  
Frontend changes: none.  
Acceptance criteria:

- App runs against PostgreSQL.
- Migrations apply cleanly.
- Existing seed/demo data can be loaded into staging.

### Task 10: Add Validation Schemas and Field Allowlists

Objective: prevent malformed input and mass assignment.  
Files likely affected: all POST/PATCH API routes, new `src/server/schemas/*`.  
Database changes: optional enum constraints after schema redesign.  
API changes: consistent 400 validation responses.  
Frontend changes: map validation errors to forms.  
Acceptance criteria:

- Every mutation route parses through Zod.
- Update handlers allowlist fields.
- Invalid role/status/stage values are rejected.

### Task 11: Add Audit Logging

Objective: capture security and workflow-relevant changes.  
Files likely affected: new audit service, MRF/candidate/document/user/org routes.  
Database changes: add `AuditLog` table.  
API changes: sensitive mutations write audit records.  
Frontend changes: optional admin audit view.  
Acceptance criteria:

- User, role, MRF approval, candidate stage, document approval/download, and employee data changes are audited.
- Audit logs include actor, entity, action, timestamp, and before/after where appropriate.

### Task 12: Make Lint, Typecheck, and Build Pass

Objective: unblock CI/deployment.  
Files likely affected: ESLint config, UI/API files, layout font usage.  
Database changes: none.  
API changes: none.  
Frontend changes: fix lint-triggering patterns.  
Acceptance criteria:

- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` passes without internet access.

### Task 13: Add CI/CD

Objective: prevent regressions.  
Files likely affected: `.github/workflows/*` or selected CI platform config.  
Database changes: migration check in CI.  
API changes: none.  
Frontend changes: none.  
Acceptance criteria:

- CI runs install, lint, typecheck, tests, build, and migration validation.
- Pull requests cannot merge when checks fail.

### Task 14: Refactor Email Architecture

Objective: make email reliable and auditable.  
Files likely affected: `src/app/api/emails/route.ts`, `src/app/api/mrfs/[id]/approve/route.ts`, `src/app/api/mrfs/[id]/send-approval-email/route.ts`, new email service/job worker.  
Database changes: add delivery status/provider ID/retry fields.  
API changes: sends enqueue jobs and return queued/sent status.  
Frontend changes: show delivery state.  
Acceptance criteria:

- Email failure is visible.
- Provider message ID is stored.
- Retries are possible.
- Templates are centralized.

### Task 15: Build MRF Approval Matrix

Objective: replace hardcoded approval flow with configurable policies.  
Files likely affected: MRF routes, approval UI, new workflow tables/services.  
Database changes: add approval policy, levels, approver assignments, delegation, SLA.  
API changes: approval endpoint resolves next approver from policy.  
Frontend changes: approval UI shows assigned approvers and SLA.  
Acceptance criteria:

- Approval flow can vary by country/department/branch/grade/budget.
- Delegation and escalation are supported.
- Approval history remains immutable.

### Task 16: Improve Candidate Workflow

Objective: make candidate lifecycle enterprise-usable.  
Files likely affected: candidate routes/pages, workflow stage service.  
Database changes: source, owner, duplicate keys, scorecards, interview feedback.  
API changes: structured candidate actions.  
Frontend changes: candidate detail tabs and pipeline board.  
Acceptance criteria:

- Candidate source and owner are tracked.
- Duplicate candidates are detected.
- Stage moves validate allowed transitions.
- Interview feedback is structured.

### Task 17: Build Document Center

Objective: centralize documents across candidate, MRF, employee, and templates.  
Files likely affected: document routes/pages, candidate documents, employee portal.  
Database changes: categories, versions, access logs, retention metadata.  
API changes: search/filter/version endpoints.  
Frontend changes: document center with preview, filters, versions, audit.  
Acceptance criteria:

- HR/Admin can search by candidate, employee, MRF, type, category, status.
- Versions and replacement chains are visible.
- Rejections preserve audit evidence.

### Task 18: Build Onboarding Task Engine

Objective: replace one long form with structured onboarding journey.  
Files likely affected: employee portal, employees page, onboarding routes.  
Database changes: onboarding tasks, task assignments, due dates, completion evidence.  
API changes: task CRUD/status endpoints.  
Frontend changes: checklist UI by employee type/country.  
Acceptance criteria:

- Tasks vary by India/Overseas and role.
- HR can track completion.
- Employee sees only assigned tasks.

### Task 19: Reporting Upgrade

Objective: provide accurate operational analytics.  
Files likely affected: reports page, new reporting APIs.  
Database changes: indexes/materialized views as needed.  
API changes: filterable report endpoints.  
Frontend changes: date/geography/department/recruiter filters, exports.  
Acceptance criteria:

- MRF status counts are accurate.
- Funnel reports can filter by date, department, country, branch, recruiter.
- CSV export works.

### Task 20: AI Foundations

Objective: safely introduce AI after governance is ready.  
Files likely affected: document service, candidate service, new AI jobs.  
Database changes: AI extraction/ranking tables with confidence and model metadata.  
API changes: async AI job endpoints.  
Frontend changes: review/accept extracted fields and candidate scores.  
Acceptance criteria:

- AI outputs are reviewable, not blindly applied.
- Model/version/confidence are stored.
- PII handling and audit logging are enforced.
