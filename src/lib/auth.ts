import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { fromBool } from "@/lib/db-bool";
import bcrypt from "bcryptjs";

async function loadRolePermissions(roleKey: string): Promise<{ permissions: string[]; approvalLevel: string | null }> {
  const role = await db("RECRUIT_T_Role").where({ key: roleKey }).first();
  if (!role) return { permissions: [], approvalLevel: null };

  const rows = await db("RECRUIT_T_RolePermission").where({ roleId: role.id }).select("permissionKey");
  return {
    permissions: rows.map((r: any) => r.permissionKey),
    approvalLevel: role.approvalLevel ?? null,
  };
}

export const authOptions: NextAuthOptions = {
  // TEMPORARY: 10-second session lifetime for testing the session-expiry
  // dialog. Revert to a normal duration (or remove maxAge for NextAuth's
  // 30-day default) before real use.
  session: { strategy: "jwt", maxAge: 10 },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        userName: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.userName || !credentials?.password) return null;

        const user = await db("RECRUIT_T_User")
          .where({ userName: credentials.userName })
          .first();

        if (!user || !fromBool(user.isActive)) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.id = user.id;
      }
      // Re-fetch on every request (not just sign-in) so a permission change an
      // admin makes to a role takes effect on the affected user's next
      // request, without requiring them to log out and back in.
      if (token.role) {
        const { permissions, approvalLevel } = await loadRolePermissions(token.role as string);
        token.permissions = permissions;
        token.approvalLevel = approvalLevel;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string }).role = token.role as string;
        (session.user as { id: string }).id = token.id as string;
        (session.user as { permissions: string[] }).permissions = (token.permissions as string[]) || [];
        (session.user as { approvalLevel: string | null }).approvalLevel = (token.approvalLevel as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
