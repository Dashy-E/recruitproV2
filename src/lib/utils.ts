import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function generateMRFNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `MRF-${year}-${random}`;
}

export const CANDIDATE_STAGES = [
  { key: "APPLIED",               label: "Applications",               step: 1  },
  { key: "INTERVIEW_1",           label: "Interview – Round 1",        step: 2  },
  { key: "INTERVIEW_2",           label: "Interview – Round 2",        step: 3  },
  { key: "INTERVIEW_3",           label: "Interview – Round 3",        step: 4  },
  { key: "PSYCHOMETRIC_TEST",     label: "Psychometric Test",          step: 5  },
  { key: "SHORTLISTED",           label: "Shortlisted / Selected",     step: 6  },
  { key: "SALARY_NEGOTIATION",    label: "Salary Negotiation & Docs",  step: 7  },
  { key: "CTC_OFFERED",           label: "CTC Offered",                step: 8  },
  { key: "OFFER_LETTER",          label: "Offer Letter Issued",        step: 9  },
  { key: "JOINED",                label: "Joined",                     step: 10 },
  { key: "ONBOARDING",            label: "Onboarding",                 step: 11 },
  { key: "EMPLOYEE_FILE",         label: "Employee File",              step: 12 },
  { key: "EMPLOYEE_FEEDBACK",     label: "Employee Feedback",          step: 13 },
  { key: "CONFIRMATION_PROCESS",  label: "Confirmation Process",       step: 14 },
  { key: "CONFIRMATION_LETTER",   label: "Confirmation Letter",        step: 15 },
] as const;

export const MRF_STATUSES = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  PENDING_DIVISIONAL: { label: "Pending Divisional/Country Approval", color: "bg-yellow-100 text-yellow-700" },
  PENDING_COUNTRY_SUPERVISOR: { label: "Pending Country Supervisor Approval", color: "bg-blue-100 text-blue-700" },
  PENDING_FUNCTIONAL: { label: "Pending Functional Approval", color: "bg-orange-100 text-orange-700" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
} as const;

export const USER_ROLES = {
  ADMIN: "Admin",
  HR: "HR",
  BRANCH_MANAGER: "Branch Manager",
  DIVISIONAL_MANAGER: "Divisional Manager",
  COUNTRY_SUPERVISOR: "Country Supervisor",
  FUNCTIONAL_HEAD: "Functional Head",
  COUNTRY_MANAGER: "Country Manager",
  CANDIDATE: "Candidate",
  EMPLOYEE: "Employee",
} as const;

export type UserRole = keyof typeof USER_ROLES;
