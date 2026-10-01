import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import {
  SiteHeader,
  SiteFooter,
  GlobalChromeProvider,
  FooterDataProvider,
} from "@/components/site-layout";
import { HydrationDebug } from "@/components/hydration-debug";
import { IntercomWidget } from "@/components/intercom-widget";
import { getSiteFooter } from "@/server/site-footer.functions";
import { buildMeta, ldJsonScript, organizationJsonLd, websiteJsonLd, SITE_NAME } from "@/lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createRootRoute({
  loader: async () => {
    try {
      const footer = await getSiteFooter();
      return { footer };
    } catch {
      return { footer: null };
    }
  },
  head: () => {
    // Root-level defaults. Individual routes override title/description via
    // their own head() function — these are the fallbacks for any route that
    // doesn't set them.
    const meta = buildMeta({
      title: "founders.click — AI Growth Engine for Sharetribe Marketplace Founders",
      description:
        "Custom-coded SEO, AI content generation, and ops tools — without the agency price tag. Built for Sharetribe marketplace founders.",
      path: "/",
      image: null,
    });
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "author", content: SITE_NAME },
        { name: "theme-color", content: "#0ea5e9" },
        ...meta.meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico" },
        // Canonical is per-route: a root-level one would be emitted alongside
        // each route's own, leaving every page with two conflicting canonicals.
        ...meta.links.filter((l) => l.rel !== "canonical"),
      ],
      scripts: [ldJsonScript(organizationJsonLd()), ldJsonScript(websiteJsonLd())],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const data = Route.useLoaderData();
  const showIntercom = pathname === "/" || pathname.startsWith("/admin");
  const footer = data?.footer;

  // The founders.click home route renders its own self-contained chrome
  // (founders-home.tsx provides its own Header + Footer). Skip the legacy
  // pool-rental SiteHeader/SiteFooter to avoid double chrome. The /templates
  // storefront reuses that same Header + Footer.
  const isFoundersHome =
    pathname === "/" || pathname === "/templates" || pathname.startsWith("/templates/");

  const content = (
    <>
      <HydrationDebug />
      {isFoundersHome ? (
        <Outlet />
      ) : (
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <GlobalChromeProvider>
              <Outlet />
            </GlobalChromeProvider>
          </div>
          <SiteFooter />
        </div>
      )}
      {showIntercom && <IntercomWidget />}
    </>
  );
  if (footer) {
    return <FooterDataProvider value={footer}>{content}</FooterDataProvider>;
  }
  return content;
}
