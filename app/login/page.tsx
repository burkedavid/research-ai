import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";

export const metadata = { title: "Sign in — Sentiment Research Hub" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl ?? "/");

  const entraConfigured = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
  // env.ts blocks this flag in a real production boot; gating on it alone
  // keeps dev login working in the e2e production build
  const devLogin = env.DEV_LOGIN_ENABLED;

  async function devSignIn(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: formData.get("callbackUrl")?.toString() || "/",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=CredentialsSignin");
      }
      throw err;
    }
  }

  async function entraSignIn(formData: FormData) {
    "use server";
    await signIn("microsoft-entra-id", {
      redirectTo: formData.get("callbackUrl")?.toString() || "/",
    });
  }

  return (
    <main className="flex min-h-screen">
      {/* brand panel — white with indigo text, matching sentimentresearch.com */}
      <div className="hidden flex-col justify-between border-r border-border bg-white p-10 lg:flex lg:w-[45%]">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg font-bold leading-tight text-brand-900">Sentiment Research</p>
            <p className="text-xs text-muted-foreground">Consumer Sentiment Intelligence Hub</p>
          </div>
        </div>
        <div>
          <BrandMark size={140} />
          <div className="mb-6 mt-8 h-1 w-32 bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
          <p className="text-3xl font-bold leading-snug text-brand-900">
            In the business of
            <br />
            getting to know people.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
            Six years of qualitative consumer research — searchable, cited and traceable back to every voice. Real
            insights, from real people.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Sentiment Research Limited</p>
      </div>

      {/* sign-in panel — soft pastel wash from the mark's palette */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-brand-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-sr-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full bg-sr-purple/15 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/4 size-56 rounded-full bg-sr-green/10 blur-3xl" />

        <Card className="relative w-full max-w-md gap-0 overflow-hidden pt-0 shadow-lg">
          <div className="h-1 w-full bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
          <CardHeader className="pt-7">
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <BrandMark size={40} />
              <p className="text-lg font-bold text-brand-900">Sentiment Research</p>
            </div>
            <CardTitle className="text-2xl text-brand-900">Sign in</CardTitle>
            <CardDescription>Access the consumer sentiment research archive.</CardDescription>
          </CardHeader>
          <CardContent className="pb-7 pt-4">
            {params.error && (
              <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Sign in failed. Check your details and try again.
              </p>
            )}

            {entraConfigured && (
              <form action={entraSignIn}>
                <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
                <Button type="submit" className="w-full">
                  Sign in with Microsoft
                </Button>
              </form>
            )}

            {devLogin && (
              <form action={devSignIn} className="mt-2 space-y-4">
                <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-brand-900">
                    Email (dev login)
                  </Label>
                  <Input id="email" name="email" type="email" required placeholder="researcher@example.com" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-brand-900">
                    Password
                  </Label>
                  <Input id="password" name="password" type="password" required className="h-11" />
                </div>
                <Button type="submit" className="h-11 w-full text-base">
                  Dev sign in
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Local development sign-in. Production uses your Microsoft account.
                </p>
              </form>
            )}

            {!entraConfigured && !devLogin && (
              <p className="text-sm text-muted-foreground">
                No sign-in method configured. Set the Entra ID environment variables.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
