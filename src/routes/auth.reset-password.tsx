import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Reset password — founders.click" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // If the URL contains a recovery token (`?type=recovery&...`) Supabase will
  // restore a session for the user — show the "set new password" form.
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (url.searchParams.has("error") || hash.has("error")) {
      setRecoveryError("This reset link is invalid or has already been used. Request a new email, or use its recovery code if provided.");
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setRecoveryError(null);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setRecoveryError("We couldn't restore your reset session. Use a recovery code or request a new email.");
      else if (data.session) setHasRecoverySession(true);
      else if (hash.has("access_token") || url.searchParams.has("code")) {
        setRecoveryError("We couldn't restore your reset session. Use a recovery code or request a new email.");
      }
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  async function verifyRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setRecoveryError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(), token: code.trim(), type: "recovery",
      });
      if (error || !data.session) {
        setRecoveryError("That recovery code is invalid or expired. Use the code from the newest reset email.");
        return;
      }
      setCode("");
      setHasRecoverySession(true);
    } catch {
      setRecoveryError("Couldn't verify the recovery code. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success("Check your email for a reset link.");
    } finally {
      setBusy(false);
    }
  }

  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated.");
      navigate({ to: "/account/learning" as never });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {hasRecoverySession ? "Set a new password" : "Reset your password"}
          </h1>

          {recoveryError && <p role="alert" className="mt-4 text-sm text-destructive">{recoveryError}</p>}

          {hasRecoverySession ? (
            <form onSubmit={setPassword} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          ) : useCode ? (
            <form onSubmit={verifyRecoveryCode} className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">Enter the recovery code from your newest reset email. Keep it private.</p>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-email">Email</Label>
                <Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-code">Recovery code</Label>
                <Input id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Verifying…" : "Verify recovery code"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setUseCode(false)}>Request a reset email</Button>
            </form>
          ) : (
            <form onSubmit={sendResetEmail} className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the email associated with your account and we'll send a reset link.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Sending…" : "Send reset link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setUseCode(true)}>Enter a recovery code</Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to="/auth"
                  search={{ redirect: "/account/learning", mode: "signin" }}
                  className="hover:text-primary"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
