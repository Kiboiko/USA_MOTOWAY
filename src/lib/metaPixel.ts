export const META_PIXEL_ID = "2129720331271665";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** The vehicle an event is about. */
export type CarEventParams = {
  slug?: string;
  title?: string;
  /** Vehicle price, so Meta can optimise for value rather than volume. */
  price?: number;
  currency?: string;
};

export type LeadEventParams = CarEventParams & {
  /** Visitor identifiers for Advanced Matching, taken from the submitted form. */
  user?: MetaAdvancedMatching;
  content_category?: string;
};

export type MetaAdvancedMatching = {
  email?: string;
  phone?: string;
  /** Full name as typed; split into first/last for Meta. */
  name?: string;
};

function pixel() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return null;
  return window.fbq;
}

function carPayload(params: LeadEventParams) {
  const payload: Record<string, unknown> = {};
  // Meta ignores `value` unless `currency` travels with it, and a bare
  // `currency` with no value is noise — keep the pair together.
  if (params.price !== undefined) {
    payload.value = params.price;
    payload.currency = params.currency || "USD";
  }
  if (params.slug) {
    payload.content_ids = [params.slug];
    payload.content_type = "product";
  }
  if (params.title) payload.content_name = params.title;
  if (params.content_category) payload.content_category = params.content_category;
  return payload;
}

/**
 * ViewContent for a vehicle page, with that vehicle's price.
 *
 * The pixel script loads after hydration, so this can run before `fbq`
 * exists; it waits for it. The snippet that defines `fbq` queues the landing
 * PageView in the same breath, so ViewContent always lands after PageView.
 * Returns a cancel function for effect cleanup.
 */
export function trackCarViewContent(params: CarEventParams): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  const attempt = () => {
    if (cancelled) return;
    const fbq = pixel();
    if (fbq) {
      fbq("track", "ViewContent", carPayload(params));
      return;
    }
    if (++attempts < 100) timer = setTimeout(attempt, 100);
  };
  // Deferred even when fbq is ready: on a client-side navigation this lets the
  // route's PageView (fired from the layout's effect) go first.
  timer = setTimeout(attempt, 0);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Call only after the server confirmed the lead was saved — an event reported
 * for a failed request poisons ad optimisation. Sends, in order:
 *   1. init with the visitor's Advanced Matching data,
 *   2. Lead,
 *   3. Purchase,
 * all carrying the vehicle's price when there is one.
 */
export function trackLeadSubmission(params: LeadEventParams = {}): void {
  const fbq = pixel();
  if (!fbq) return;
  if (params.user) identify(params.user);
  fbq("track", "Lead", carPayload(params));
  fbq("track", "Purchase", carPayload(params));
}

/**
 * Re-runs `fbq('init')` with Advanced Matching data.
 *
 * The visitor is anonymous on page load, so this cannot go into the initial
 * init call — it is applied the moment a form is submitted, right before the
 * events, so they carry the identifiers. Calling `init` again with the same
 * pixel id updates the user data rather than creating a second pixel.
 *
 * Values are normalised to Meta's rules (lowercase, digits-only phone with
 * country code); the pixel then hashes them with SHA-256 in the browser, so
 * raw email and phone never leave the visitor's device.
 */
function identify(data: MetaAdvancedMatching) {
  const fbq = pixel();
  if (!fbq) return;

  const params: Record<string, string> = {};

  const email = data.email?.trim().toLowerCase();
  if (email) params.em = email;

  const digits = (data.phone ?? "").replace(/\D/g, "");
  if (digits) {
    // Meta expects the country code and no leading "+": 10 US digits get a "1".
    params.ph = digits.length === 10 ? `1${digits}` : digits;
  }

  const parts = (data.name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length > 0) params.fn = parts[0];
  if (parts.length > 1) params.ln = parts[parts.length - 1];

  if (Object.keys(params).length === 0) return;

  fbq("init", META_PIXEL_ID, params);
}
