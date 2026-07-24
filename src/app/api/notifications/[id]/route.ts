import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toBool } from "@/lib/db-bool";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id!;

  const { id } = await params;
  const body = await req.json();

  // Users can only mark their own notifications
  const notification = await db("RECRUIT_T_Notification").where({ id, userId }).first();
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db("RECRUIT_T_Notification")
    .where({ id })
    .update({ isRead: toBool(body.isRead ?? true) })
    .returning("*");

  return NextResponse.json(updated);
}
