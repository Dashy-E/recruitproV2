import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedFileUrl } from "@/lib/s3";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const candidate = await db("RECRUIT_T_Candidate").where({ userId }).first();
  if (!candidate) return NextResponse.json({ employee: null, documents: [] });

  const employeeRow = await db("RECRUIT_T_Employee").where({ candidateId: candidate.id }).first();

  let employee = null;
  if (employeeRow) {
    let mrf = null;
    if (candidate.mrfId) {
      const mrfRow = await db("RECRUIT_T_MRF").where({ id: candidate.mrfId }).first();
      if (mrfRow) {
        const department = await db("RECRUIT_T_Department").where({ id: mrfRow.departmentId }).first();
        mrf = { ...mrfRow, department };
      }
    }
    employee = {
      ...employeeRow,
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        currentStage: candidate.currentStage,
        recruitmentEntity: candidate.recruitmentEntity,
        mrf,
      },
    };
  }

  const documentsRaw = await db("RECRUIT_T_Document")
    .where({ candidateId: candidate.id })
    .select("id", "name", "fileUrl", "fileType", "fileSize", "documentType", "approvalStatus", "extractedData", "createdAt")
    .orderBy("createdAt", "desc");
  // fileUrl is stored as a bare S3 key (private bucket) — sign it for viewing.
  const documents = await Promise.all(
    documentsRaw.map(async (d: any) => ({ ...d, fileUrl: await getSignedFileUrl(d.fileUrl) }))
  );

  return NextResponse.json({ employee, documents });
}
