import type { NextAuthConfig } from "next-auth";

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
      if (auth?.error === "SessionRevoked") return false;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
