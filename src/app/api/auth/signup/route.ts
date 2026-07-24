import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { name, userName, email, password } = await req.json();

  if (!name?.trim() || !userName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Name, username, email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const [existingUserName, existingEmail] = await Promise.all([
    db("RECRUIT_T_User").where({ userName }).first(),
    db("RECRUIT_T_User").where({ email }).first(),
  ]);
  if (existingUserName) return NextResponse.json({ error: "Username already in use" }, { status: 409 });
  if (existingEmail) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const now = new Date();
  await db("RECRUIT_T_User").insert({
    id: newId(),
    name,
    userName,
    email,
    password: await bcrypt.hash(password, 10),
    role: "CANDIDATE",
    isActive: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Alert every admin so they see it in the notification bell and can activate the account
  try {
    const admins = await db("RECRUIT_T_User").where({ role: "ADMIN", isActive: 1 }).select("id");
    await Promise.all(
      admins.map((admin: any) =>
        db("RECRUIT_T_Notification").insert({
          id: newId(),
          userId: admin.id,
          type: "USER_SIGNUP",
          title: "New account pending activation",
          message: `${name} (${userName}) signed up and is awaiting activation.`,
          link: "/dashboard/users",
          isRead: 0,
          createdAt: now,
        })
      )
    );
  } catch { /* notification failure is non-fatal */ }

  return NextResponse.json(
    { message: "Account created. An administrator must activate your account before you can sign in." },
    { status: 201 }
  );
}
