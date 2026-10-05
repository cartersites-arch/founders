import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Public widget identifier only. The matching secret belongs in Supabase Auth.
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
export const CAPTCHA_ENABLED = Boolean(siteKey);
export interface AuthCaptchaHandle { reset: () => void }
interface Turnstile {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
const provider = () => (window as Window & { turnstile?: Turnstile }).turnstile;
let loading: Promise<Turnstile> | undefined;
function loadProvider(): Promise<Turnstile> {
  if (provider()) return Promise.resolve(provider()!);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const timer = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      loading = undefined;
      reject(new Error("Verification could not load."));
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timer);
      if (provider()) resolve(provider()!);
      else fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

export const AuthCaptcha = forwardRef<AuthCaptchaHandle, { onToken: (token: string) => void }>(
  function AuthCaptcha({ onToken }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widget = useRef<{ api: Turnstile; id: string } | undefined>(undefined);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useImperativeHandle(ref, () => ({ reset() {
      onToken("");
      if (widget.current) widget.current.api.reset(widget.current.id);
    } }), [onToken]);
    useEffect(() => {
      if (!CAPTCHA_ENABLED) return;
      let active = true;
      onToken("");
      setError(false);
      const invalidate = () => { if (active) onToken(""); };
      void loadProvider().then(api => {
        if (!active || !container.current) return;
        const id = api.render(container.current, {
          sitekey: siteKey, size: "flexible", theme: "auto",
          callback: (token: string) => { if (active) { onToken(token); setError(false); } },
          "expired-callback": invalidate,
          "timeout-callback": invalidate,
          "error-callback": () => { invalidate(); if (active) setError(true); },
        });
        widget.current = { api, id };
      }).catch(() => { if (active) { invalidate(); setError(true); } });
      return () => {
        active = false;
        if (widget.current) { widget.current.api.remove(widget.current.id); widget.current = undefined; }
        onToken("");
      };
    }, [onToken, attempt]);
    if (!CAPTCHA_ENABLED) return null;
    return <div className="space-y-2">
      <div ref={container} aria-label="Security verification" />
      {error && <div role="alert" className="text-sm text-destructive">
        Verification could not finish. Check your connection and try again.
        <button type="button" className="ml-2 underline" onClick={() => setAttempt(n => n + 1)}>Retry verification</button>
      </div>}
    </div>;
  },
);
