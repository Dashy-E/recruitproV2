import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([]);
  const userId = (session.user as { id?: string })?.id!;

  try {
    const notifications = await db("RECRUIT_T_Notification")
      .where({ userId })
      .orderBy("createdAt", "desc")
      .limit(50);
    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json([]);
  }
}
