import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { CredentialsSignin } from "@auth/core/errors";

import { authConfig } from "@/lib/auth.config";
import { ACCOUNT_DISABLED_ERROR } from "@/lib/auth/error-codes";
import { recordLoginAttempt } from "@/lib/auth/login-history";
import {
  applyJwtClientUpdate,
  applyJwtUserFields,
  buildSessionFromToken,
} from "@/lib/auth/jwt-session-callbacks";
import {
  getIpFromRequest,
  getUserAgentFromRequest,
} from "@/lib/auth/request-meta";
import {
  applySessionVersionToToken,
} from "@/lib/auth/session-version";
import { engineerSessionFlags } from "@/lib/auth/two-factor-policy";
import { prisma } from "@/lib/prisma";
import {
  AUTH_RATE_LIMIT_ERROR,
  authRateLimitKey,
  checkRateLimit,
  clearFailures,
  recordFailure,
} from "@/lib/security/rate-limit";

class AuthRateLimitedError extends CredentialsSignin {
  code = AUTH_RATE_LIMIT_ERROR;
}

class AccountDisabledError extends CredentialsSignin {
  code = ACCOUNT_DISABLED_ERROR;
}

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
        const rateLimitKey = authRateLimitKey("login", ipAddress);

        const rateCheck = checkRateLimit(rateLimitKey);
        if (!rateCheck.allowed) {
          throw new AuthRateLimitedError();
        }

        if (!email || !password) {
          recordFailure(rateLimitKey);
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
          recordFailure(rateLimitKey);
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
          recordFailure(rateLimitKey);
          await recordLoginAttempt({
            email,
            status: "FAILED",
            userId: user.id,
            ipAddress,
            userAgent,
          });
          return null;
        }

        if (!user.isActive) {
          await recordLoginAttempt({
            email,
            status: "FAILED",
            userId: user.id,
            ipAddress,
            userAgent,
          });
          throw new AccountDisabledError();
        }

        clearFailures(rateLimitKey);
        clearFailures(authRateLimitKey("2fa", ipAddress));

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

        const engineerFlags = engineerSessionFlags(user.role);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is2FAEnabled: engineerFlags?.is2FAEnabled ?? user.is2FAEnabled,
          needs2FASetup:
            engineerFlags?.needs2FASetup ??
            (!user.is2FAEnabled || !user.twoFactorSecret),
          twoFactorVerified: engineerFlags?.twoFactorVerified ?? false,
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
        token = applyJwtUserFields(token, user);
      } else if (trigger === "update") {
        token = applyJwtClientUpdate(
          token,
          session as Record<string, unknown> | undefined
        );
      }

      return applySessionVersionToToken(token);
    },
    async session({ session, token }) {
      return buildSessionFromToken(session, token);
    },
  },
});
