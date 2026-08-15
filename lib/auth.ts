import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";

declare module "next-auth" {
  interface User {
    role: Role;
    is2FAEnabled: boolean;
    needs2FASetup: boolean;
    twoFactorVerified: boolean;
    requiresPasswordChange: boolean;
  }

  interface Session {
    user: User & {
      id: string;
      email: string;
      name: string;
    };
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is2FAEnabled: user.is2FAEnabled,
          needs2FASetup: !user.is2FAEnabled || !user.twoFactorSecret,
          twoFactorVerified: false,
          requiresPasswordChange: user.requiresPasswordChange,
        };
      },
    }),
  ],
});
