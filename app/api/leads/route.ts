import { NextResponse, type NextRequest } from "next/server";
import { verifyTurnstileToken } from "@/src/lib/server/turnstile";
import { formatPrice } from "@/src/lib/vehicles";
import { getManagedVehicle } from "@/src/lib/server/inventoryStore";
import { hasEmailCredentials, sendInquiryEmail } from "@/src/lib/email";
import { formatUsPhone, US_PHONE_HINT } from "@/src/lib/phone";
import { isValidEmail, EMAIL_HINT } from "@/src/lib/validation";
import { appendLeadRow, hasSheetsCredentials } from "@/src/lib/server/googleSheets";

// Column order of the "Leads" tab. Also written as the header row when the
// tab has to be created, so the two can never drift apart.
const LEAD_COLUMNS = [
  "Received at",
  "Source",
  "Topic",
  "Name",
  "Phone",
  "Email",
  "Message",
  "Price",
  "Link",
  "Purchase sent",
  "Vehicle title",
  "Vehicle slug",
  "Page URL",
  "Referrer",
  "User agent"
] as const;

type IncomingLead = {
  source?: unknown;
  topic?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  price?: unknown;
  link?: unknown;
  purchaseSent?: unknown;
  vehicleTitle?: unknown;
  vehicleSlug?: unknown;
  pageUrl?: unknown;
  turnstileToken?: unknown;
};

export const runtime = "nodejs";

const MAX_FIELD_LENGTH = 2000;

function clean(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.GOOGLE_LEADS_WEBHOOK_URL;
  const webhookToken = process.env.GOOGLE_LEADS_WEBHOOK_TOKEN;
  const webhookEnabled = Boolean(webhookUrl && webhookToken);
  const sheetsEnabled = await hasSheetsCredentials();
  const emailEnabled = hasEmailCredentials();

  if (!webhookEnabled && !sheetsEnabled && !emailEnabled) {
    return jsonError("Lead capture is not configured", 503);
  }

  let body: IncomingLead;
  try {
    body = (await request.json()) as IncomingLead;
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const source = clean(body.source, 80);
  const name = clean(body.name, 200);
  const phone = clean(body.phone, 80);
  const email = clean(body.email, 200);
  const message = clean(body.message);
  const pageUrl = clean(body.pageUrl, 500);
  const link = clean(body.link, 500) || pageUrl;
  const vehicleSlug = clean(body.vehicleSlug, 200) || extractVehicleSlug(link) || extractVehicleSlug(pageUrl);
  const price = clean(body.price, 120) || await inferVehiclePrice(vehicleSlug);

  if (!["support_chat", "vehicle_inquiry"].includes(source)) {
    return jsonError("Invalid lead source", 400);
  }
  if (!name) {
    return jsonError("Name is required", 400);
  }
  // The browser checks these too, but the endpoint is public — these are the
  // checks that actually hold. Both channels are required, and both must be
  // usable: a lead we cannot reach is worse than no lead at all.
  const normalizedPhone = formatUsPhone(phone);
  if (normalizedPhone === null) {
    return jsonError(US_PHONE_HINT, 400);
  }
  if (!isValidEmail(email)) {
    return jsonError(EMAIL_HINT, 400);
  }

  const turnstileOk = await verifyTurnstileToken(request, clean(body.turnstileToken, 3000));
  if (!turnstileOk) {
    return jsonError("Verification failed. Please try again.", 400);
  }

  const forwardedLead = {
    token: webhookToken,
    receivedAt: new Date().toISOString(),
    source,
    topic: clean(body.topic, 120),
    name,
    // Stored in one consistent shape so the sheet column stays sortable.
    phone: normalizedPhone,
    email,
    message,
    price,
    link,
    purchaseSent: clean(body.purchaseSent, 120),
    vehicleTitle: clean(body.vehicleTitle, 300),
    vehicleSlug,
    pageUrl,
    referrer: clean(request.headers.get("referer"), 500),
    userAgent: clean(request.headers.get("user-agent"), 500)
  };

  // A lead is only lost if every configured sink fails, so each one is
  // attempted independently rather than short-circuiting on the first error.
  const sinks: { name: string; run: Promise<void> }[] = [];
  if (sheetsEnabled) sinks.push({ name: "sheets", run: appendToSheet(forwardedLead) });
  if (emailEnabled) {
    sinks.push({
      name: "email",
      run: sendInquiryEmail({
        name,
        phone: normalizedPhone,
        email,
        message,
        source,
        topic: clean(body.topic, 120),
        vehicleTitle: clean(body.vehicleTitle, 300),
        vehicleSlug,
        price,
        pageUrl
      })
    });
  }
  if (webhookEnabled) sinks.push({ name: "webhook", run: forwardToWebhook(webhookUrl!, forwardedLead) });

  const results = await Promise.allSettled(sinks.map((sink) => sink.run));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[leads] ${sinks[index].name} sink failed:`, result.reason);
    }
  });

  // The lead is only lost if every sink failed. A failed email notification
  // must not 502 a lead that Sheets already recorded, or the visitor retries
  // and files a duplicate.
  if (!results.some((result) => result.status === "fulfilled")) {
    return jsonError("Lead capture failed", 502);
  }

  return NextResponse.json({ ok: true });
}

type ForwardedLead = {
  receivedAt: string;
  source: string;
  topic: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  price: string;
  link: string;
  purchaseSent: string;
  vehicleTitle: string;
  vehicleSlug: string;
  pageUrl: string;
  referrer: string;
  userAgent: string;
};

async function appendToSheet(lead: ForwardedLead) {
  await appendLeadRow(
    [
      lead.receivedAt,
      lead.source,
      lead.topic,
      lead.name,
      lead.phone,
      lead.email,
      lead.message,
      lead.price,
      lead.link,
      lead.purchaseSent,
      lead.vehicleTitle,
      lead.vehicleSlug,
      lead.pageUrl,
      lead.referrer,
      lead.userAgent
    ],
    [...LEAD_COLUMNS]
  );
}

async function forwardToWebhook(webhookUrl: string, lead: ForwardedLead & { token?: string }) {
  const controller = new AbortController();
  const timeout = windowlessTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(lead),
      signal: controller.signal
    });

    const responseText = await response.text();
    if (!response.ok) throw new Error(`webhook responded ${response.status}`);

    const result = safeJson(responseText) as { ok?: unknown } | null;
    if (!result || result.ok !== true) throw new Error("webhook did not return ok:true");
  } finally {
    clearTimeout(timeout);
  }
}

function windowlessTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractVehicleSlug(value: string) {
  const match = value.match(/\/(?:inventory|sold)\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function inferVehiclePrice(slug: string) {
  if (!slug) return "";
  const vehicle = await getManagedVehicle(slug);
  return vehicle ? formatPrice(vehicle) ?? "" : "";
}
