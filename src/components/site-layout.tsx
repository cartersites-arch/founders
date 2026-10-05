import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_FOOTER,
  type SiteFooterSettings,
  type FooterLink,
  type FooterMarket,
} from "@/lib/site-footer-defaults";

const FOOTER_YEAR = 2026;

const GlobalChromeContext = React.createContext(false);
const FooterDataContext = React.createContext<SiteFooterSettings>(DEFAULT_FOOTER);

export function GlobalChromeProvider({ children }: { children: React.ReactNode }) {
  return <GlobalChromeContext.Provider value={true}>{children}</GlobalChromeContext.Provider>;
}

export function FooterDataProvider({
  value,
  children,
}: {
  value: SiteFooterSettings;
  children: React.ReactNode;
}) {
  return <FooterDataContext.Provider value={value}>{children}</FooterDataContext.Provider>;
}

function useSuppressChrome() {
  return React.useContext(GlobalChromeContext);
}

function rel(path: string): string {
  if (/^([a-z]+:|\/\/|#|mailto:|tel:)/i.test(path)) return path;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function SiteHeader() {
  if (useSuppressChrome()) return null;
  return <SiteHeaderInner />;
}

const HEADER_LINKS: Array<{ label: string; href: string; internal?: boolean; exact?: boolean }> = [
  { label: "Home", href: "/", internal: true, exact: true },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Help Center", href: "/help-center", internal: true },
];

function SiteHeaderInner() {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  // Lock body scroll when menu is open
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" onClick={close}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <polyline points="8 6 4 12 8 18" />
              <polyline points="16 6 20 12 16 18" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            founders.click
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {HEADER_LINKS.map((l) =>
            l.internal ? (
              <Link
                key={l.label}
                to={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                activeOptions={l.exact ? { exact: true } : undefined}
                activeProps={{ className: "text-foreground" }}
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={rel(l.href)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            search={{ redirect: "/admin/dashboard", mode: "signup" } as never}
            className="hidden h-9 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 sm:inline-flex"
          >
            Start free trial
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile slide-out */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden md:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={close}
        />
        <aside
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={`absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-background shadow-xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <span className="text-base font-semibold text-foreground">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="flex flex-col">
              {HEADER_LINKS.map((l) => (
                <li key={l.label}>
                  {l.internal ? (
                    <Link
                      to={l.href}
                      onClick={close}
                      className="block rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                      activeOptions={l.exact ? { exact: true } : undefined}
                      activeProps={{
                        className:
                          "block rounded-md px-3 py-3 text-base font-semibold bg-muted text-foreground",
                      }}
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={rel(l.href)}
                      onClick={close}
                      className="block rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-border p-4">
            <Link
              to="/auth"
              search={{ redirect: "/admin/dashboard", mode: "signup" } as never}
              onClick={close}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
            >
              Start free trial
            </Link>
          </div>
        </aside>
      </div>
    </header>
  );
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.4v7A10 10 0 0 0 22 12z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.244 2H21l-6.52 7.46L22 22h-6.79l-4.78-6.26L4.8 22H2.04l6.97-7.97L2 2h6.96l4.32 5.71L18.24 2zm-2.38 18h1.88L7.27 4H5.27l10.6 16z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.244 2H21l-6.52 7.46L22 22h-6.79l-4.78-6.26L4.8 22H2.04l6.97-7.97L2 2h6.96l4.32 5.71L18.24 2zm-2.38 18h1.88L7.27 4H5.27l10.6 16z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.4 4 12 4 12 4s-7.4 0-9.4.4A3 3 0 0 0 .5 6.5C0 8.5 0 12 0 12s0 3.5.5 5.5a3 3 0 0 0 2.1 2.1C4.6 20 12 20 12 20s7.4 0 9.4-.4a3 3 0 0 0 2.1-2.1C24 15.5 24 12 24 12s0-3.5-.5-5.5zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.9-2 3.9-2 4.2 0 5 2.8 5 6.4V21h-4v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4V9z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.9.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.9.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.9-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.9-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-3.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M19.6 6.7a5.5 5.5 0 0 1-3.3-1.1V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v2.6a3 3 0 1 0 2.1 2.8V2h2.5a5.5 5.5 0 0 0 3.3 4.7v.1z" />
    </svg>
  ),
  pinterest: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2a10 10 0 0 0-3.7 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.1-4.7 1.1-4.7s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.4 0 .8-.5 2-.8 3.2-.2.9.5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.1 0 .8.3 1.7.7 2.2.1.1.1.2.1.3l-.3 1c0 .2-.2.2-.3.1-1.2-.6-2-2.4-2-3.9 0-3.1 2.3-6 6.6-6 3.5 0 6.2 2.5 6.2 5.8 0 3.4-2.2 6.2-5.2 6.2-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.8-.8 1.9-1.2 2.5A10 10 0 1 0 12 2z" />
    </svg>
  ),
};

function socialIcon(key: string): React.ReactNode {
  return (
    SOCIAL_ICONS[key.toLowerCase()] ?? (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
      </svg>
    )
  );
}

export function SiteFooter() {
  if (useSuppressChrome()) return null;
  return <SiteFooterInner />;
}

function SiteFooterInner() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <polyline points="8 6 4 12 8 18" />
              <polyline points="16 6 20 12 16 18" />
            </svg>
          </div>
          <span>founders.click</span>
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/" hash="features" className="hover:text-foreground">
            Features
          </Link>
          <Link to="/" hash="pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/" hash="faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/help-center" className="hover:text-foreground">
            Help Center
          </Link>
          <Link to="/privacy-policy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
        <div className="text-xs">© {FOOTER_YEAR} founders.click</div>
      </div>
    </footer>
  );
}

function _FooterColumn({ title, items }: { title: string; items: FooterLink[] }) {
  return (
    <div className="lg:col-span-2">
      <h4 className="text-base font-semibold text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((it) => (
          <li key={it.label + it.href}>
            <a href={rel(it.href)} className="hover:text-primary">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
