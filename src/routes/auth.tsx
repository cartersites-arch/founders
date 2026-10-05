import { AuthCaptcha, CAPTCHA_ENABLED, type AuthCaptchaHandle } from "@/components/auth-captcha";
import { MIN_NEW_PASSWORD_LENGTH, MAX_NEW_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createFileRoute, useNavigate, redirect, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Allow only same-origin internal paths: must start with "/" and not "//" or "/\".
// Rejects "//evil.com", "/\\evil.com", and any value containing "://".
const SAFE_PATH = /^\/(?!\/|\\)[^\s]*$/;
const safeRedirect = (v: unknown): string => {
  if (typeof v !== "string") return "/admin/dashboard";
  if (!SAFE_PATH.test(v) || v.includes("://")) return "/admin/dashboard";
  return v;
};

const SearchSchema = z.object({
  redirect: z.preprocess(safeRedirect, z.string()).default("/admin/dashboard"),
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => SearchSchema.parse(search),
  beforeLoad: async ({ search, location }) => {
    // Recovery routes must render and restore their session independently.
    if (location.pathname !== "/auth" && location.pathname !== "/auth/") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: search.redirect as never });
    }
  },
  component: AuthRoute,
  head: () => ({
    meta: [
      { title: "Sign in or create an account — founders.click" },
      {
        name: "description",
        content:
          "Sign in to founders.click — the AI growth engine for Sharetribe marketplace founders.",
      },
    ],
  }),
});

function AuthRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/auth" || pathname === "/auth/" ? <AuthPage /> : <Outlet />;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<AuthCaptchaHandle>(null);

  useEffect(() => setMode(search.mode), [search.mode]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: search.redirect as never });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: search.redirect as never });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, search.redirect]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (CAPTCHA_ENABLED && !captchaToken)) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          toast.error("Please enter your full name.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: CAPTCHA_ENABLED ? captchaToken : undefined,
            emailRedirectTo: `${window.location.origin}${search.redirect}`,
            data: { full_name: fullName.trim(), display_name: fullName.trim() },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: CAPTCHA_ENABLED ? captchaToken : undefined } });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Signed in.");
        navigate({ to: search.redirect as never });
      }
    } catch {
      toast.error("Could not connect. Please try again.");
    } finally {
      captchaRef.current?.reset();
      setBusy(false);
    }
  }

  // Google OAuth deferred — provider not enabled in Supabase. Email/password
  // and magic-link via Supabase Auth are the supported methods for now.

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Create account
            </button>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "signup" ? "Start your free trial" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "14 days free, no credit card. Generate your first 100 pages before you decide whether to pay us a dollar."
              : "Pick up where you left off."}
          </p>

          <form onSubmit={handleEmail} className="space-y-4 mt-6">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used in your account profile and email greetings.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <Link
                    to="/auth/reset-password"
                    search={(prev: any) => prev}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Forgot?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === "signup" ? MIN_NEW_PASSWORD_LENGTH : 8}
                maxLength={mode === "signup" ? MAX_NEW_PASSWORD_LENGTH : undefined}
                required
              />
            </div>
            <AuthCaptcha key={mode} ref={captchaRef} onToken={setCaptchaToken} />
            <Button type="submit" disabled={busy || (CAPTCHA_ENABLED && !captchaToken)} className="w-full">
              {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
