// Runs once when the Next.js server process starts (stable since Next 15) —
// used here to start the in-process MRF reminder scheduler (see
// src/lib/mrf-reminders.ts) without needing an external cron job.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/mrf-reminders");
    startReminderScheduler();
  }
}
