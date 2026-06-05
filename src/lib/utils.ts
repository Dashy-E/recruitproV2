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
  { key: "APPLIED", label: "Applied", step: 1 },
  { key: "AI_SCREENING", label: "AI Screening", step: 2 },
  { key: "SHORTLISTED", label: "Shortlisted", step: 3 },
  { key: "INTERVIEW", label: "Interview", step: 4 },
  { key: "PSYCHOMETRIC_TEST", label: "Psychometric Test", step: 5 },
  { key: "OFFER", label: "Offer", step: 6 },
  { key: "PROBATION", label: "Probation", step: 7 },
  { key: "CHEMISTRY_TEST_TRAINING", label: "Chemistry Test Training", step: 8 },
  { key: "CHEMISTRY_TEST", label: "Chemistry Test", step: 9 },
  { key: "ONBOARDED", label: "Onboarded", step: 10 },
] as const;

export const MRF_STATUSES = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  PENDING_DIVISIONAL: { label: "Pending Divisional Approval", color: "bg-yellow-100 text-yellow-700" },
  PENDING_FUNCTIONAL: { label: "Pending Functional Approval", color: "bg-orange-100 text-orange-700" },
  PENDING_COUNTRY: { label: "Pending Country Approval", color: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
} as const;

export const USER_ROLES = {
  ADMIN: "Admin",
  HR: "HR",
  BRANCH_MANAGER: "Branch Manager",
  DIVISIONAL_MANAGER: "Divisional Manager",
  FUNCTIONAL_HEAD: "Functional Head",
  COUNTRY_MANAGER: "Country Manager",
  CANDIDATE: "Candidate",
} as const;

export type UserRole = keyof typeof USER_ROLES;
