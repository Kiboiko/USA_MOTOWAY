import "server-only";

import { createHash } from "node:crypto";
import type { ClientRecord, MetaPurchaseLog } from "@/src/lib/clients";

// Server-side Purchase events via the Meta Conversions API.
// https://developers.facebook.com/docs/marketing-api/conversions-api
//
// A car sale closes long after the visitor left the site, so the browser pixel
// can never see it. The sale is reported from the admin instead, matched to the
// ad click by the fbclid from the landing link and the customer's hashed
// email / phone / name.

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v24.0";

// Deliberately separate from the browser pixel (src/lib/metaPixel.ts): the site
// now fires a Purchase on every submitted lead to that pixel, so reporting real
// sales there as well would count one customer twice. Sales keep going to the
// original dataset unless META_CAPI_PIXEL_ID says otherwise.
const CAPI_PIXEL_ID = process.env.META_CAPI_PIXEL_ID || "2181988102663499";

export function hasMetaCapiCredentials() {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN);
}

export function purchaseEventId(client: ClientRecord) {
  // Stable per client: if a retry ever reaches Meta twice, it deduplicates.
  return `purchase_${client.id}`;
}

export async function sendMetaPurchase(client: ClientRecord): Promise<MetaPurchaseLog> {
  const eventId = purchaseEventId(client);
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE || undefined;
  const log: MetaPurchaseLog = {
    ok: false,
    attemptedAt: new Date().toISOString(),
    eventId,
    value: client.price,
    currency: "USD",
    testEventCode
  };

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return { ...log, error: "META_CAPI_ACCESS_TOKEN is not configured on the server." };

  const purchasedAt = client.purchasedAt ? Date.parse(client.purchasedAt) : Date.now();
  const link = splitVehicleLink(client.vehicleUrl ?? "");
  const userData: Record<string, string | string[]> = buildUserData(client);
  if (link.fbclid) {
    // The ad click id from the landing link, in Meta's click-id format
    // (fb.<subdomain index>.<creation ms>.<fbclid>). The real click time is
    // unknown, so the client's creation time stands in: it is earlier than
    // the purchase, which is what Meta requires. fbclid must stay unmodified.
    const createdMs = Math.min(Date.parse(client.createdAt) || purchasedAt, purchasedAt);
    userData.fbc = `fb.1.${createdMs}.${link.fbclid}`;
    log.withAdClick = true;
  }

  // Shape agreed with the ad account owner (Events Manager payload format):
  // a website Purchase with attribution_data and original_event_data. Meta
  // accepts website events up to 7 days old, so report the sale promptly.
  const eventTime = Math.floor(purchasedAt / 1000);
  const event = {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: eventId,
    action_source: "website",
    ...(link.pageUrl ? { event_source_url: link.pageUrl } : {}),
    user_data: userData,
    // The whole sale is credited to Meta — the "0.3" in Meta's sample payload is only an example value.
    attribution_data: {
      attribution_share: "1.0"
    },
    custom_data: {
      currency: "USD",
      value: (client.price ?? 0).toFixed(2),
      order_id: client.id,
      content_type: "product",
      ...(client.vehicleSlug ? { content_ids: [client.vehicleSlug] } : {}),
      ...(client.vehicleTitle ? { content_name: client.vehicleTitle } : {})
    },
    original_event_data: {
      event_name: "Purchase",
      event_time: eventTime
    }
  };
  log.payload = { data: [event] };

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${CAPI_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: [event],
        access_token: token,
        ...(testEventCode ? { test_event_code: testEventCode } : {})
      }),
      signal: AbortSignal.timeout(15000)
    });
    const json = (await response.json().catch(() => null)) as {
      events_received?: number;
      fbtrace_id?: string;
      error?: { message?: string; error_user_msg?: string; fbtrace_id?: string };
    } | null;

    if (!response.ok || !json || json.error || json.events_received !== 1) {
      const message = json?.error?.error_user_msg || json?.error?.message || `Meta responded ${response.status}`;
      return { ...log, fbtraceId: json?.error?.fbtrace_id ?? json?.fbtrace_id, error: message };
    }
    return { ...log, ok: true, fbtraceId: json.fbtrace_id };
  } catch (error) {
    return { ...log, error: error instanceof Error ? error.message : "Network error while contacting Meta." };
  }
}

/** Separates the ad click id from a pasted landing link and drops ad tracking parameters from the page URL. */
function splitVehicleLink(value: string) {
  if (!value) return { pageUrl: "", fbclid: "" };
  try {
    const url = new URL(value);
    const fbclid = url.searchParams.get("fbclid") ?? "";
    for (const key of [...url.searchParams.keys()]) {
      if (key === "fbclid" || key.startsWith("utm_")) url.searchParams.delete(key);
    }
    return { pageUrl: url.toString(), fbclid };
  } catch {
    return { pageUrl: "", fbclid: "" };
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Normalisation follows Meta's customer-information rules; every value is
// hashed here, so no raw personal data is sent.
function buildUserData(client: ClientRecord) {
  const data: Record<string, string[]> = {};
  const add = (key: string, value: string | undefined) => {
    if (value) data[key] = [sha256(value)];
  };

  add("em", client.email.trim().toLowerCase());

  const digits = client.phone.replace(/\D/g, "");
  add("ph", digits.length === 10 ? `1${digits}` : digits);

  const names = client.name
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  add("fn", names[0]);
  if (names.length > 1) add("ln", names[names.length - 1]);

  add("ct", client.city.toLowerCase().replace(/[^\p{L}]/gu, ""));
  const state = client.state.toLowerCase().replace(/[^a-z]/g, "");
  add("st", state.length === 2 ? state : undefined);
  add("zp", client.zip.replace(/\D/g, "").slice(0, 5));
  add("country", "us");
  add("external_id", client.id);

  return data;
}
