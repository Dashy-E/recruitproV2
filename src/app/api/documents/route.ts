import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { extractDocumentData } from "@/lib/extract-document";
import { hasPermission } from "@/lib/permissions";
import { uploadToS3, getSignedFileUrl } from "@/lib/s3";

// Friendly, easily-greppable S3 subfolder per document type — keeps Aadhaar
// and Passport uploads clearly separated for the planned OCR/address-extraction
// follow-up, rather than mixed in with everything else under "Other".
const TYPE_FOLDER: Record<string, string> = {
  AADHAAR: "Aadhar",
  PASSPORT: "Passport",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");

  if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    if (["CANDIDATE", "EMPLOYEE"].includes(role || "")) {
      // Can only view their own docs
      const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
      if (!candidate || (candidateId && candidate.id !== candidateId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const docs: any[] = await db("RECRUIT_T_Document")
    .modify((qb) => {
      if (candidateId) qb.where({ candidateId });
    })
    .orderBy("createdAt", "desc");

  if (!docs.length) return NextResponse.json([]);

  const uploaderIds = [...new Set(docs.map((d: any) => d.uploadedById).filter(Boolean))];
  const candidateIds = [...new Set(docs.map((d: any) => d.candidateId).filter(Boolean))];
  const mrfIds = [...new Set(docs.map((d: any) => d.mrfId).filter(Boolean))];

  const [uploaders, candidates, mrfs] = await Promise.all([
    db("RECRUIT_T_User").whereIn("id", uploaderIds).select("id", "name"),
    db("RECRUIT_T_Candidate").whereIn("id", candidateIds).select("id", "firstName", "lastName"),
    db("RECRUIT_T_MRF").whereIn("id", mrfIds).select("id", "referenceNumber", "mrfNumber", "title"),
  ]);

  const employees = candidateIds.length
    ? await db("RECRUIT_T_Employee").whereIn("candidateId", candidateIds).select("id", "candidateId")
    : [];

  const result = await Promise.all(docs.map(async (d: any) => ({
    ...d,
    fileUrl: await getSignedFileUrl(d.fileUrl),
    uploadedBy: (() => {
      const u = uploaders.find((x: any) => x.id === d.uploadedById);
      return u ? { name: u.name } : null;
    })(),
    candidate: (() => {
      const c = candidates.find((x: any) => x.id === d.candidateId);
      if (!c) return null;
      const employee = employees.find((e: any) => e.candidateId === c.id);
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        employee: employee ? { id: employee.id } : null,
      };
    })(),
    mrf: (() => {
      const m = mrfs.find((x: any) => x.id === d.mrfId);
      return m ? { referenceNumber: m.referenceNumber, mrfNumber: m.mrfNumber, title: m.title } : null;
    })(),
  })));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  const formData = await req.formData();
  const files = formData.getAll("file") as File[];
  const documentType = (formData.get("documentType") as string) || "OTHER";
  const candidateId = formData.get("candidateId") as string | null;
  const mrfId = formData.get("mrfId") as string | null;

  if (!files.length) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (role === "EMPLOYEE") {
    // Employees can only upload for their own candidate profile (onboarding docs)
    const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
    if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 });
    if (candidateId && candidateId !== candidate.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "CANDIDATE") {
    // Candidates can only upload for themselves, only before SHORTLISTED
    const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
    if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 404 });
    const preShortlistStages = ["APPLIED", "INTERVIEW_1", "INTERVIEW_2", "INTERVIEW_3"];
    if (!preShortlistStages.includes(candidate.currentStage)) {
      return NextResponse.json({ error: "Document upload is only allowed before the Shortlisted stage" }, { status: 400 });
    }
    if (candidateId && candidateId !== candidate.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!hasPermission(session, "MANAGE_DOCUMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Candidate uploads start as PENDING (need approval); HR/Admin uploads auto-approved
  const approvalStatus = hasPermission(session, "MANAGE_DOCUMENTS") ? "APPROVED" : "PENDING";

  // Resolve candidateId for the uploader if they're a candidate or employee
  let resolvedCandidateId = candidateId;
  if (["CANDIDATE", "EMPLOYEE"].includes(role || "") && !resolvedCandidateId) {
    const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
    resolvedCandidateId = candidate?.id ?? null;
  }

  // Same per-candidate folder resumes already use, so every document for a
  // candidate lives together in one place, with a subfolder per document
  // type — keeps Aadhaar/Passport clearly identifiable for the planned
  // address-extraction follow-up instead of mixed in with everything else.
  const typeFolder = TYPE_FOLDER[documentType] || "Other";
  let folderPrefix = "Recruitment/Document";
  if (resolvedCandidateId) {
    const candidate = await db("RECRUIT_T_Candidate").where({ id: resolvedCandidateId }).select("firstName").first();
    const candidateFolder = `${(candidate?.firstName || "Candidate").replace(/[^a-zA-Z0-9]/g, "") || "Candidate"}_${resolvedCandidateId}`;
    folderPrefix = `Recruitment/Candidate/${candidateFolder}/${typeFolder}`;
  }

  // Attempt to extract text data from PDFs for known document types
  const extractableTypes = ["AADHAAR", "PAN", "PASSPORT", "BANK_DETAILS"];

  const created = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${folderPrefix}/${Date.now()}-${safeFileName}`;
    await uploadToS3(key, buffer, file.type || "application/octet-stream");

    let extractedData: string | null = null;
    if (extractableTypes.includes(documentType)) {
      const fields = await extractDocumentData(buffer, file.type || "", documentType);
      if (fields) extractedData = JSON.stringify(fields);
    }

    const [doc] = await db("RECRUIT_T_Document")
      .insert({
        id: newId(),
        name: file.name,
        fileUrl: key,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        documentType,
        uploadedById: userId,
        candidateId: resolvedCandidateId || null,
        mrfId: mrfId || null,
        approvalStatus,
        extractedData,
        createdAt: new Date(),
      })
      .returning("*");
    created.push({ ...doc, fileUrl: await getSignedFileUrl(doc.fileUrl) });
  }

  return NextResponse.json(files.length === 1 ? created[0] : created, { status: 201 });
}
