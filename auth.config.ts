import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Edge-safe base config: no database imports, usable from middleware.
 * The credentials dev provider (which hits the DB) is added in auth.ts,
 * which only runs in the Node.js route handler.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      // Enriched only at sign-in; service functions re-read the user row
      // from the DB on every request, so stale claims cannot widen access.
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role;
        token.transcriptAccess = (user as { transcriptAccess?: boolean }).transcriptAccess;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as "admin" | "researcher" | "viewer") ?? "viewer";
        session.user.transcriptAccess = Boolean(token.transcriptAccess);
      }
      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: "admin" | "researcher" | "viewer";
      transcriptAccess: boolean;
    };
  }
}
