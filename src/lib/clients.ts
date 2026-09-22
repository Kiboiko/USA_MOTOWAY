// Shared between the admin clients page and its API, so both sides agree on
// the record shape. Server-only logic lives in src/lib/server/clientStore.ts.

export type ClientStatus = "open" | "purchased" | "lost";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  open: "In progress",
  purchased: "Bought",
  lost: "Didn't buy"
};

/** Outcome of the last attempt to report this client's purchase to Meta. */
export type MetaPurchaseLog = {
  ok: boolean;
  attemptedAt: string;
  eventId: string;
  value?: number;
  currency?: string;
  fbtraceId?: string;
  testEventCode?: string;
  /** True when the vehicle link carried an fbclid, sent to Meta as the ad click id. */
  withAdClick?: boolean;
  /** The request body sent to Meta, without the access token (personal data in it is hashed). */
  payload?: unknown;
  error?: string;
};

export type ClientRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zip: string;
  vehicleSlug: string;
  vehicleTitle: string;
  /** Link to the bought vehicle (our listing or any other page); absent on records created before the field existed. */
  vehicleUrl?: string;
  /** Sale price in USD; required before a purchase can be reported to Meta. */
  price?: number;
  notes: string;
  status: ClientStatus;
  purchasedAt?: string;
  metaPurchase?: MetaPurchaseLog;
};

/** Fields the manager edits directly; status changes to "purchased" go through the purchase endpoint. */
export type ClientInput = Partial<
  Pick<
    ClientRecord,
    | "name"
    | "phone"
    | "email"
    | "city"
    | "state"
    | "zip"
    | "vehicleSlug"
    | "vehicleTitle"
    | "vehicleUrl"
    | "price"
    | "notes"
    | "status"
  >
>;

/** Listing slug from a link to one of our vehicle pages (/inventory/<slug> or /sold/<slug>), or "". */
export function vehicleSlugFromUrl(url: string) {
  let path: string;
  try {
    const parsed = new URL(normalizeVehicleUrl(url));
    // Another dealer's /inventory/<id> is not one of our listings.
    if (parsed.hostname !== "carviondealer.com" && parsed.hostname !== "www.carviondealer.com") return "";
    path = parsed.pathname;
  } catch {
    return "";
  }
  const match = path.match(/^\/(?:inventory|sold)\/([^/?#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Adds https:// to a bare "example.com/..." link; returns "" for anything that is not an http(s) URL. */
export function normalizeVehicleUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
