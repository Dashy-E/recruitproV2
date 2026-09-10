import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSignedFileUrl } from "@/lib/s3";
import { extractDocumentData } from "@/lib/extract-document";

const TYPE_LABEL: Record<string, string> = { AADHAAR: "Aadhar", PASSPORT: "Passport" };

// Reads the address off the candidate's most recently uploaded Aadhar or
// Passport document — from its already-extracted data if upload-time
// extraction already found one, otherwise runs extraction now (covers
// documents uploaded before this address pattern/OCR path existed) and
// persists the result so the next lookup is instant.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "MANAGE_CANDIDATES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const type = new URL(req.url).searchParams.get("type");
  if (type !== "AADHAAR" && type !== "PASSPORT") {
    return NextResponse.json({ error: "type must be AADHAAR or PASSPORT" }, { status: 400 });
  }
  const label = TYPE_LABEL[type];

  const doc = await db("RECRUIT_T_Document")
    .where({ candidateId: id, documentType: type })
    .orderBy("createdAt", "desc")
    .first();
  if (!doc) return NextResponse.json({ error: `No ${label} document uploaded for this candidate yet` }, { status: 404 });

  let fields: Record<string, string> = {};
  try { fields = doc.extractedData ? JSON.parse(doc.extractedData) : {}; } catch { /* ignore malformed data */ }

  if (!fields.address) {
    const signedUrl = await getSignedFileUrl(doc.fileUrl);
    if (!signedUrl) return NextResponse.json({ error: "Could not access the uploaded file" }, { status: 500 });
    const fileRes = await fetch(signedUrl);
    if (!fileRes.ok) return NextResponse.json({ error: "Could not download the uploaded file" }, { status: 500 });
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const extracted = await extractDocumentData(buffer, doc.fileType || "", type);
    if (extracted) {
      fields = { ...fields, ...extracted };
      await db("RECRUIT_T_Document").where({ id: doc.id }).update({ extractedData: JSON.stringify(fields) }).catch(() => {});
    }
  }

  if (!fields.address) {
    return NextResponse.json({ error: `Could not find an address on the uploaded ${label} document` }, { status: 404 });
  }

  return NextResponse.json({ address: fields.address });
}
