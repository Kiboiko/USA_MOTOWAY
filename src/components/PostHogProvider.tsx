"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { isAnalyticsEnabled, trackEvent } from "@/src/lib/analytics";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (typeof window !== "undefined" && posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
    person_profiles: "always"
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    trackEvent("page_view", {
      path: pathname,
      has_query: searchParams.toString().length > 0
    });
  }, [pathname, searchParams]);

  return null;
}

function PostHogSafeLinkTracking() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      if (href.startsWith("tel:")) {
        trackEvent("phone_click", { path: window.location.pathname });
      } else if (href.startsWith("mailto:")) {
        trackEvent("email_click", { path: window.location.pathname });
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!isAnalyticsEnabled()) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogSafeLinkTracking />
      {children}
    </PHProvider>
  );
}
