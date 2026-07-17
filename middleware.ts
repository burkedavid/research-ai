import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: session-cookie check only (§B9.1 — every route behind auth).
// Role checks happen server-side in service functions, never here alone.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = {
  // Everything except auth endpoints, the Inngest webhook (signature-verified
  // by the Inngest SDK itself), static assets (any path with a file
  // extension, e.g. the logo), and the login page.
  matcher: ["/((?!api/auth|api/inngest|_next/static|_next/image|login|.*\\..*).*)"],
};
