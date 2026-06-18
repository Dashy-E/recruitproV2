import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { extractDocumentData } from "@/lib/extract-document";

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
      candidate: { select: { id: true, firstName: true, lastName: true, employee: { select: { id: true } } } },
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
  const filePath = join(uploadDir, safeFileName);
  await writeFile(filePath, buffer);
  const fileUrl = `/uploads/${safeFileName}`;

  // Candidate uploads start as PENDING (need approval); HR/Admin uploads auto-approved
  const approvalStatus = ["ADMIN", "HR"].includes(role || "") ? "APPROVED" : "PENDING";

  // Resolve candidateId for the uploader if they're a candidate or employee
  let resolvedCandidateId = candidateId;
  if (["CANDIDATE", "EMPLOYEE"].includes(role || "") && !resolvedCandidateId) {
    const candidate = await prisma.candidate.findFirst({ where: { userId } });
    resolvedCandidateId = candidate?.id ?? null;
  }

  // Attempt to extract text data from PDFs for known document types
  const extractableTypes = ["AADHAAR", "PAN", "PASSPORT", "BANK_DETAILS"];
  let extractedData: string | null = null;
  if (extractableTypes.includes(documentType)) {
    const fields = await extractDocumentData(filePath, file.type || "", documentType);
    if (fields) extractedData = JSON.stringify(fields);
  }

  const doc = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO Document (id, name, fileUrl, fileType, fileSize, documentType, uploadedById, candidateId, mrfId, approvalStatus, extractedData, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    file.name, fileUrl, file.type || "application/octet-stream", file.size,
    documentType, userId, resolvedCandidateId || null, mrfId || null,
    approvalStatus, extractedData, new Date().toISOString()
  );

  return NextResponse.json(doc[0], { status: 201 });
}
