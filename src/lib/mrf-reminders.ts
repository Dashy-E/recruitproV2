import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { fromBool } from "@/lib/db-bool";
import { STATUS_TO_APPROVAL_LEVELS } from "@/lib/permissions";
import { getEligibleApprovers } from "@/lib/mrf-approval";
import nodemailer from "nodemailer";

const REMINDER_INTERVAL_DAYS = 3;
// Hourly is precise enough for a 3-day cadence without needing exact timing.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const PENDING_STATUSES = ["PENDING_DIVISIONAL", "PENDING_COUNTRY_SUPERVISOR", "PENDING_FUNCTIONAL"];

interface ReminderMrf {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  orgUnitId: string;
  departmentId: string;
  createdAt: Date | string;
  lastReminderSentAt: Date | string | null;
  holdUntil: Date | string | null;
  holdIndefinite: number | boolean;
}

function daysSince(date: Date | string): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

// A hold pauses reminders without blocking Approve/Reject — see the "hold"
// dropdown on the MRF detail page and POST/DELETE /api/mrfs/[id]/hold.
function isOnHold(mrf: ReminderMrf): boolean {
  if (fromBool(mrf.holdIndefinite)) return true;
  if (!mrf.holdUntil) return false;
  return new Date(mrf.holdUntil).getTime() > Date.now();
}

async function sendReminderEmail(toEmail: string, toName: string, mrf: ReminderMrf) {
  if (!process.env.SMTP_HOST) return;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || "noreply@recruitpro.com",
      to: toEmail,
      subject: `Reminder: MRF ${mrf.referenceNumber} is still awaiting your approval`,
      text: `Dear ${toName},\n\nThis is a reminder that MRF "${mrf.title}" (${mrf.referenceNumber}) is still awaiting your approval.\n\nPlease log in to review:\n${process.env.NEXTAUTH_URL}/dashboard/approvals\n\nIf you need more time before deciding, you can put this MRF on hold from its detail page to pause these reminders for a while.\n\nThank you,\nRecruitPro ERP`,
    });
  } catch { /* SMTP failure is non-fatal */ }
}

async function notifyUser(userId: string, mrf: ReminderMrf) {
  try {
    await db("RECRUIT_T_Notification").insert({
      id: newId(),
      userId,
      type: "MRF_REMINDER",
      title: `Reminder: MRF ${mrf.referenceNumber} awaiting your approval`,
      message: `"${mrf.title}" is still pending your review.`,
      link: `/dashboard/approvals`,
      isRead: 0,
      createdAt: new Date(),
    });
  } catch { /* notification failure is non-fatal */ }
}

// Scans every pending MRF and reminds its current stage's eligible
// approver(s) if it's been >= REMINDER_INTERVAL_DAYS since the last reminder
// (or since creation, if none has been sent yet) — skipping anything on hold.
export async function sendDueReminders(): Promise<void> {
  const mrfs: ReminderMrf[] = await db("RECRUIT_T_MRF")
    .whereIn("status", PENDING_STATUSES)
    .select(
      "id", "referenceNumber", "title", "status", "orgUnitId", "departmentId",
      "createdAt", "lastReminderSentAt", "holdUntil", "holdIndefinite"
    );

  for (const mrf of mrfs) {
    if (isOnHold(mrf)) continue;

    const since = daysSince(mrf.lastReminderSentAt ?? mrf.createdAt);
    if (since < REMINDER_INTERVAL_DAYS) continue;

    const levels = STATUS_TO_APPROVAL_LEVELS[mrf.status] || [];
    const recipients = await getEligibleApprovers(mrf, levels, true);
    if (recipients.length === 0) continue;

    await Promise.all(
      recipients.map(async (r) => {
        await notifyUser(r.id, mrf);
        await sendReminderEmail(r.email, r.name, mrf);
      })
    );

    await db("RECRUIT_T_MRF").where({ id: mrf.id }).update({ lastReminderSentAt: new Date() });
  }
}

// Self-contained in-process scheduler — no external cron setup needed since
// this app runs as a persistent Node process (next dev/start), not a
// serverless platform. Guarded by globalThis the same way src/lib/db.ts's
// connection pool is, so dev-mode hot reloads don't stack up duplicate
// intervals.
const globalForReminders = globalThis as unknown as { mrfReminderInterval?: ReturnType<typeof setInterval> };

export function startReminderScheduler() {
  if (globalForReminders.mrfReminderInterval) return;
  globalForReminders.mrfReminderInterval = setInterval(() => {
    sendDueReminders().catch((err) => console.error("MRF reminder check failed:", err));
  }, CHECK_INTERVAL_MS);
  // Also run once shortly after boot, rather than waiting a full interval
  // for the first check.
  sendDueReminders().catch((err) => console.error("MRF reminder check failed:", err));
}
