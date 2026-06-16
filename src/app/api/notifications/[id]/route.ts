import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id!;

  const { id } = await params;
  const body = await req.json();

  // Users can only mark their own notifications
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: body.isRead ?? true },
  });

  return NextResponse.json(updated);
}
