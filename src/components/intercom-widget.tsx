import { isLocalIsolation } from "@/lib/isolation-policy";
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import Intercom, { update, shutdown } from "@intercom/messenger-js-sdk";
import { supabase } from "@/integrations/supabase/client";
import { getIntercomAppId } from "@/server/intercom.functions";

/** Pull useful IDs out of the current path for support context. */
function deriveContext(pathname: string) {
  const ctx: Record<string, string | boolean> = { current_url: pathname };

  // /l/<slug>/<id> — listing detail
  const listing = pathname.match(/^\/l\/[^/]+\/([^/?#]+)/);
  if (listing) ctx.listing_id = listing[1];

  // /admin/* — admin surfaces
  if (pathname.startsWith("/admin")) {
    ctx.is_admin_page = true;
    const adminSection = pathname.match(/^\/admin\/([^/?#]+)/);
    if (adminSection) ctx.admin_section = adminSection[1];
    // /admin/learning/<userId>
    const learner = pathname.match(/^\/admin\/learning\/([^/?#]+)/);
    if (learner) ctx.learner_user_id = learner[1];
  }

  // /p/<slug> — content page
  const contentPage = pathname.match(/^\/p\/([^/?#]+)/);
  if (contentPage) ctx.content_page_slug = contentPage[1];

  return ctx;
}

/**
 * Boots the Intercom messenger widget. Identifies the signed-in user when
 * a Supabase session is present; otherwise boots anonymously. Updates
 * Intercom with current URL + relevant IDs on every route change.
 */
export function IntercomWidget() {
  const fetchAppId = useServerFn(getIntercomAppId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLocalIsolation()) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    let booted = false;
    let currentAppId = "";

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const ctx = deriveContext(window.location.pathname);
      Intercom({
        app_id: currentAppId,
        ...(user
          ? {
              user_id: user.id,
              email: user.email ?? undefined,
              name:
                (user.user_metadata?.full_name as string | undefined) ??
                (user.user_metadata?.name as string | undefined),
            }
          : {}),
        ...ctx,
      });
      booted = true;
    };

    (async () => {
      const { appId } = await fetchAppId();
      if (cancelled || !appId) return;
      currentAppId = appId;
      await boot();

      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        shutdown();
        booted = false;
        void boot();
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    // Expose boot state to the path-change effect via window flag
    (window as unknown as { __intercomBooted?: () => boolean }).__intercomBooted = () => booted;

    return () => {
      cancelled = true;
      unsub?.();
      try {
        shutdown();
      } catch {
        /* noop */
      }
    };
  }, [fetchAppId]);

  // Push updated metadata on every client-side navigation.
  useEffect(() => {
    const isBooted = (
      window as unknown as { __intercomBooted?: () => boolean }
    ).__intercomBooted?.();
    if (!isBooted) return;
    try {
      update(deriveContext(pathname));
    } catch {
      /* noop */
    }
  }, [pathname]);

  return null;
}
