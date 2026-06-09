import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const candidate = await prisma.candidate.findFirst({ where: { userId } });
  if (!candidate) return NextResponse.json({ employee: null, documents: [] });

  const employee = await prisma.employee.findUnique({
    where: { candidateId: candidate.id },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          currentStage: true,
          mrf: { include: { department: true } },
        },
      },
    },
  });

  const documents = await prisma.document.findMany({
    where: { candidateId: candidate.id },
    select: { id: true, name: true, fileUrl: true, fileType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ employee, documents });
}
