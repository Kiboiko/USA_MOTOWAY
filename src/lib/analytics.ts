"use client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
  /\/$/,
  ""
);
const DISTINCT_ID_KEY = "carviondealer_posthog_distinct_id";

const BLOCKED_PROPERTY_NAMES = new Set([
  "email",
  "phone",
  "name",
  "full_name",
  "message",
  "text",
  "contact",
  "user_agent"
]);

export function isAnalyticsEnabled() {
  return Boolean(POSTHOG_KEY);
}

export function safeAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (value === undefined || value === null) return false;
      return !BLOCKED_PROPERTY_NAMES.has(key.toLowerCase());
    })
  );
}

export function trackEvent(event: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined" || !isAnalyticsEnabled()) return;

  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    properties: {
      distinct_id: getDistinctId(),
      $current_url: window.location.href,
      $host: window.location.host,
      $pathname: window.location.pathname,
      $process_person_profile: true,
      ...safeAnalyticsProperties(properties)
    }
  });

  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {});
}

function getDistinctId() {
  try {
    const existing = window.localStorage.getItem(DISTINCT_ID_KEY);
    if (existing) return existing;

    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(DISTINCT_ID_KEY, next);
    return next;
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
