import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([]);
  const userId = (session.user as { id?: string })?.id!;

  try {
    const notifications = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
      userId
    );
    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json([]);
  }
}
