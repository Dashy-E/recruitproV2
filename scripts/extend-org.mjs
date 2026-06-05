import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function run() {
  const india = await prisma.country.findFirst({ where: { locationType: "INDIA" } });
  if (!india) { console.log("India not found — seed first"); process.exit(1); }

  const swDiv = await prisma.division.findFirst({ where: { countryId: india.id, name: { contains: "South West" } } });
  const ecDiv = await prisma.division.findFirst({ where: { countryId: india.id, name: { contains: "East Central" } } });
  if (!swDiv || !ecDiv) { console.log("Divisions not found"); process.exit(1); }

  const added = [];

  async function ensureState(name, divisionId) {
    const ex = await prisma.state.findFirst({ where: { name, divisionId } });
    if (ex) return ex;
    const c = await prisma.state.create({ data: { name, divisionId } });
    added.push("State: " + name);
    return c;
  }

  async function ensureBranch(name, code, countryId, stateId) {
    const ex = await prisma.branch.findFirst({ where: { code } });
    if (ex) return ex;
    const c = await prisma.branch.create({ data: { name, code, countryId, stateId } });
    added.push("Branch: " + name);
    return c;
  }

  // South West Division
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

  // East Central Division
  const wb = await ensureState("West Bengal", ecDiv.id);
  await ensureBranch("West Bengal", "WB", india.id, wb.id);
  await ensureBranch("Kolkata", "KOL", india.id, wb.id);
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

  if (added.length > 0) {
    console.log("Added:", added.join(", "));
  } else {
    console.log("All entries already exist — no changes needed.");
  }
}

run()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
