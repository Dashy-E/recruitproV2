import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mrf = await prisma.mRF.findUnique({
    where: { id },
    include: {
      country: true,
      division: true,
      branch: true,
      department: true,
      designation: true,
      createdBy: { select: { name: true, email: true } },
      approvalRecords: {
        include: { approver: { select: { name: true } }, document: true },
        orderBy: { recordedAt: "desc" },
      },
      candidates: {
        include: { user: { select: { name: true, email: true } } },
      },
      documents: { include: { uploadedBy: { select: { name: true } } } },
    },
  });

  if (!mrf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mrf);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "HR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const mrf = await prisma.mRF.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(mrf);
}
