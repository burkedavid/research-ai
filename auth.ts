import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { authConfig } from "./auth.config";

const DEV_PASSWORD = "dev-password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    // Local development and e2e only (§B3: credentials provider for local dev
    // only). env.ts rejects DEV_LOGIN_ENABLED=true in a real production boot,
    // so gating on the flag alone is safe — and required, because the e2e
    // suite runs a production build with dev login enabled.
    ...(env.DEV_LOGIN_ENABLED
      ? [
          Credentials({
            name: "Dev login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (credentials?.password !== DEV_PASSWORD) return null;
              const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, String(credentials.email)));
              if (!user || !user.active) return null;
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                transcriptAccess: user.transcriptAccess,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Entra ID sign-ins map to a provisioned, active user row; unknown or
      // suspended users are rejected (§A13.1 least privilege, leaver removal).
      if (account?.provider === "microsoft-entra-id") {
        const oid = account.providerAccountId;
        const email = user.email?.toLowerCase();
        if (!email) return false;
        const [row] = await db.select().from(users).where(eq(users.email, email));
        if (!row || !row.active) return false;
        if (!row.entraOid) {
          await db.update(users).set({ entraOid: oid }).where(eq(users.id, row.id));
        }
        user.id = row.id;
        (user as { role?: string }).role = row.role;
        (user as { transcriptAccess?: boolean }).transcriptAccess = row.transcriptAccess;
      }
      return true;
    },
  },
  events: {
    async signIn({ user }) {
      await audit({ userId: user.id, action: "login", entityType: "user", entityId: user.id });
    },
  },
});
