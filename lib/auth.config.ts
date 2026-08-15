import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isLogin = pathname.includes("/login");
      const is2fa =
        pathname.includes("/setup-2fa") ||
        pathname.includes("/verify-2fa") ||
        pathname.includes("/force-password-change");
      if (isLogin || is2fa) return true;
      return !!auth?.user;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.is2FAEnabled = user.is2FAEnabled;
        token.needs2FASetup = user.needs2FASetup;
        token.twoFactorVerified = user.twoFactorVerified;
        token.requiresPasswordChange = user.requiresPasswordChange;
      }

      if (trigger === "update" && session) {
        token.needs2FASetup = (session as { needs2FASetup?: boolean }).needs2FASetup ?? token.needs2FASetup;
        token.twoFactorVerified = (session as { twoFactorVerified?: boolean }).twoFactorVerified ?? token.twoFactorVerified;
        token.is2FAEnabled = (session as { is2FAEnabled?: boolean }).is2FAEnabled ?? token.is2FAEnabled;
        token.requiresPasswordChange =
          (session as { requiresPasswordChange?: boolean }).requiresPasswordChange ??
          token.requiresPasswordChange;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.is2FAEnabled = token.is2FAEnabled as boolean;
      session.user.needs2FASetup = token.needs2FASetup as boolean;
      session.user.twoFactorVerified = token.twoFactorVerified as boolean;
      session.user.requiresPasswordChange = token.requiresPasswordChange as boolean;
      return session;
    },
  },
} satisfies NextAuthConfig;
