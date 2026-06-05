import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Idempotent: adds missing states and branches without duplicating existing ones.
// South West Division: Gandhidham, Mumbai, Udaipur, Chennai, Hospet, Goa
// East Central Division: West Bengal (Kolkata), Bhubaneswar, Barbil, Vizag, West Orissa, Guwahati, Katni

export async function POST() {
  try {
    const india = await prisma.country.findFirst({ where: { locationType: "INDIA" } });
    if (!india) {
      return NextResponse.json({ error: "India country not found. Please seed first." }, { status: 400 });
    }

    const swDiv = await prisma.division.findFirst({ where: { countryId: india.id, name: { contains: "South West" } } });
    const ecDiv = await prisma.division.findFirst({ where: { countryId: india.id, name: { contains: "East Central" } } });

    if (!swDiv || !ecDiv) {
      return NextResponse.json({ error: "Divisions not found. Please seed first." }, { status: 400 });
    }

    const added: string[] = [];

    // Helper: find or create state
    async function ensureState(name: string, divisionId: string) {
      const existing = await prisma.state.findFirst({ where: { name, divisionId } });
      if (existing) return existing;
      const created = await prisma.state.create({ data: { name, divisionId } });
      added.push(`State: ${name}`);
      return created;
    }

    // Helper: find or create branch
    async function ensureBranch(name: string, code: string, countryId: string, stateId: string) {
      const existing = await prisma.branch.findFirst({ where: { code } });
      if (existing) return existing;
      const created = await prisma.branch.create({ data: { name, code, countryId, stateId } });
      added.push(`Branch: ${name}`);
      return created;
    }

    // ── South West Division ──────────────────────────────────────────
    const gujarat = await ensureState("Gujarat", swDiv.id);
    await ensureBranch("Gandhidham", "GDM", india.id, gujarat.id);

    const maharashtra = await ensureState("Maharashtra", swDiv.id);
    await ensureBranch("Mumbai", "MUM", india.id, maharashtra.id);

    const rajasthan = await ensureState("Rajasthan", swDiv.id);
    await ensureBranch("Udaipur", "UDR", india.id, rajasthan.id);

    const tamilNadu = await ensureState("Tamil Nadu", swDiv.id);
    await ensureBranch("Chennai", "CHN", india.id, tamilNadu.id);

    const karnataka = await ensureState("Karnataka", swDiv.id);
    await ensureBranch("Hospet", "HSP", india.id, karnataka.id);

    const goa = await ensureState("Goa", swDiv.id);
    await ensureBranch("Goa", "GOA", india.id, goa.id);

    // ── East Central Division ────────────────────────────────────────
    const wb = await ensureState("West Bengal", ecDiv.id);
    await ensureBranch("West Bengal", "WB", india.id, wb.id);
    await ensureBranch("Kolkata", "KOL", india.id, wb.id);   // keep existing if any

    const odisha = await ensureState("Odisha", ecDiv.id);
    await ensureBranch("Bhubaneswar", "BHU", india.id, odisha.id);
    await ensureBranch("Barbil", "BBL", india.id, odisha.id);
    await ensureBranch("West Orissa", "WOR", india.id, odisha.id);

    const ap = await ensureState("Andhra Pradesh", ecDiv.id);
    await ensureBranch("Vizag", "VZG", india.id, ap.id);

    const assam = await ensureState("Assam", ecDiv.id);
    await ensureBranch("Guwahati", "GUW", india.id, assam.id);

    const mp = await ensureState("Madhya Pradesh", ecDiv.id);
    await ensureBranch("Katni", "KTN", india.id, mp.id);

    return NextResponse.json({
      message: added.length > 0 ? `Added ${added.length} items.` : "Already up to date.",
      added,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
