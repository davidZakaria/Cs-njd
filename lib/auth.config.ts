import type { NextAuthConfig } from "next-auth";

import {
  applyJwtClientUpdate,
  applyJwtUserFields,
  buildSessionFromToken,
} from "@/lib/auth/jwt-session-callbacks";
import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";

export { SESSION_REVOKED_ERROR };

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/en/login",
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
      if (auth?.error === SESSION_REVOKED_ERROR) return false;
      return !!auth?.user;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        return applyJwtUserFields(token, user);
      }

      if (trigger === "update") {
        return applyJwtClientUpdate(
          token,
          session as Record<string, unknown> | undefined
        );
      }

      return token;
    },
    session({ session, token }) {
      return buildSessionFromToken(session, token);
    },
  },
} satisfies NextAuthConfig;
