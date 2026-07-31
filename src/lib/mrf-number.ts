import { db } from "@/lib/db";

async function nextInSequence(column: "referenceNumber" | "mrfNumber", prefix: string): Promise<string> {
  const last = await db("RECRUIT_T_MRF")
    .whereRaw(`"${column}" LIKE ?`, [`${prefix}%`])
    .orderBy(column, "desc")
    .first();
  let seq = 1;
  if (last) {
    const n = parseInt(last[column].slice(prefix.length), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

// Assigned immediately at creation, in its own sequence, so every MRF is
// identifiable from day one — independent of whether/when it gets approved.
export async function generateReferenceNumber(): Promise<string> {
  return nextInSequence("referenceNumber", `REF-${new Date().getFullYear()}-`);
}

// Assigned only once an MRF clears its final approval stage (see
// approve/route.ts) — not at creation — so this sequence reflects approval
// order, with no gaps left by MRFs that are still pending or get rejected.
export async function generateMRFNumber(): Promise<string> {
  return nextInSequence("mrfNumber", `MRF-${new Date().getFullYear()}-`);
}
