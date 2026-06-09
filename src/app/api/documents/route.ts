import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");

  if (!["ADMIN", "HR"].includes(role || "")) {
    if (["CANDIDATE", "EMPLOYEE"].includes(role || "")) {
      // Can only view their own docs
      const candidate = await prisma.candidate.findFirst({ where: { userId } });
      if (!candidate || (candidateId && candidate.id !== candidateId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const where = candidateId ? { candidateId } : {};
  const docs = await prisma.document.findMany({
    where,
    include: {
      uploadedBy: { select: { name: true } },
      candidate: { select: { firstName: true, lastName: true } },
      mrf: { select: { mrfNumber: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = (formData.get("documentType") as string) || "OTHER";
  const candidateId = formData.get("candidateId") as string | null;
  const mrfId = formData.get("mrfId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (role === "EMPLOYEE") {
    // Employees can only upload for their own candidate profile (onboarding docs)
    const candidate = await prisma.candidate.findFirst({ where: { userId } });
    if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 });
    if (candidateId && candidateId !== candidate.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "CANDIDATE") {
    // Candidates can only upload for themselves, only before SHORTLISTED
    const candidate = await prisma.candidate.findFirst({ where: { userId } });
    if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 });
    const preShortlistStages = ["APPLIED", "INTERVIEW_1", "INTERVIEW_2", "INTERVIEW_3"];
    if (!preShortlistStages.includes(candidate.currentStage)) {
      return NextResponse.json({ error: "Document upload is only allowed before the Shortlisted stage" }, { status: 400 });
    }
    if (candidateId && candidateId !== candidate.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(join(uploadDir, safeFileName), buffer);
  const fileUrl = `/uploads/${safeFileName}`;

  // Candidate uploads start as PENDING (need approval); HR/Admin uploads auto-approved
  const approvalStatus = ["ADMIN", "HR"].includes(role || "") ? "APPROVED" : "PENDING";

  // Resolve candidateId for the uploader if they're a candidate or employee
  let resolvedCandidateId = candidateId;
  if (["CANDIDATE", "EMPLOYEE"].includes(role || "") && !resolvedCandidateId) {
    const candidate = await prisma.candidate.findFirst({ where: { userId } });
    resolvedCandidateId = candidate?.id ?? null;
  }

  const doc = await prisma.document.create({
    data: {
      name: file.name,
      fileUrl,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      documentType,
      uploadedById: userId,
      candidateId: resolvedCandidateId || null,
      mrfId: mrfId || null,
      approvalStatus,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
