import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

/** Edge-safe auth for middleware — must not import Prisma or Node-only modules. */
export const { auth: middlewareAuth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
