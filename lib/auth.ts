import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { authConfig } from "@/lib/auth.config";
import { recordLoginAttempt } from "@/lib/auth/login-history";
import {
  getIpFromRequest,
  getUserAgentFromRequest,
} from "@/lib/auth/request-meta";
import {
  applySessionVersionToToken,
  SESSION_REVOKED_ERROR,
} from "@/lib/auth/session-version";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface User {
    role: Role;
    is2FAEnabled: boolean;
    needs2FASetup: boolean;
    twoFactorVerified: boolean;
    requiresPasswordChange: boolean;
    sessionVersion: number;
  }

  interface Session {
    user: User & {
      id: string;
      email: string;
      name: string;
    };
    error?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    is2FAEnabled: boolean;
    needs2FASetup: boolean;
    twoFactorVerified: boolean;
    requiresPasswordChange: boolean;
    sessionVersion?: number;
    error?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const ipAddress = getIpFromRequest(request);
        const userAgent = getUserAgentFromRequest(request);

        if (!email || !password) {
          await recordLoginAttempt({
            email: email || "unknown",
            status: "FAILED",
            ipAddress,
            userAgent,
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || user.deletedAt) {
          await recordLoginAttempt({
            email,
            status: "FAILED",
            ipAddress,
            userAgent,
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          await recordLoginAttempt({
            email,
            status: "FAILED",
            userId: user.id,
            ipAddress,
            userAgent,
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await recordLoginAttempt({
          email,
          status: "SUCCESS",
          userId: user.id,
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is2FAEnabled: user.is2FAEnabled,
          needs2FASetup: !user.is2FAEnabled || !user.twoFactorSecret,
          twoFactorVerified: false,
          requiresPasswordChange: user.requiresPasswordChange,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.is2FAEnabled = user.is2FAEnabled;
        token.needs2FASetup = user.needs2FASetup;
        token.twoFactorVerified = user.twoFactorVerified;
        token.requiresPasswordChange = user.requiresPasswordChange;
        token.sessionVersion = user.sessionVersion;
        delete token.error;
      }

      if (trigger === "update" && session) {
        token.needs2FASetup =
          (session as { needs2FASetup?: boolean }).needs2FASetup ??
          token.needs2FASetup;
        token.twoFactorVerified =
          (session as { twoFactorVerified?: boolean }).twoFactorVerified ??
          token.twoFactorVerified;
        token.is2FAEnabled =
          (session as { is2FAEnabled?: boolean }).is2FAEnabled ??
          token.is2FAEnabled;
        token.requiresPasswordChange =
          (session as { requiresPasswordChange?: boolean })
            .requiresPasswordChange ?? token.requiresPasswordChange;
      }

      return applySessionVersionToToken(token);
    },
    async session({ session, token }) {
      if (token.error === SESSION_REVOKED_ERROR) {
        return {
          ...session,
          user: undefined,
          error: SESSION_REVOKED_ERROR,
        } as unknown as typeof session;
      }

      if (!token.id) {
        return session;
      }

      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.is2FAEnabled = token.is2FAEnabled as boolean;
      session.user.needs2FASetup = token.needs2FASetup as boolean;
      session.user.twoFactorVerified = token.twoFactorVerified as boolean;
      session.user.requiresPasswordChange =
        token.requiresPasswordChange as boolean;
      session.user.sessionVersion = token.sessionVersion as number;
      return session;
    },
  },
});
