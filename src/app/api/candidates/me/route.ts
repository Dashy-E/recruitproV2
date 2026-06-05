import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  if (role !== "CANDIDATE") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const candidate = await prisma.candidate.findFirst({
    where: { userId },
    include: {
      mrf: {
        include: {
          country: true,
          branch: true,
          department: true,
          designation: true,
        },
      },
      stageHistory: { orderBy: { changedAt: "asc" } },
      documents: {
        orderBy: { createdAt: "desc" },
      },
      offerDetail: true,
    },
  });

  if (!candidate) return NextResponse.json(null, { status: 200 });
  return NextResponse.json(candidate);
}
