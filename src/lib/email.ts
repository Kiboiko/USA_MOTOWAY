import "server-only";

// Lead notifications are sent through Resend's REST API. No SDK: one POST is
// cheaper than another dependency, and this keeps the Node runtime bundle small.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10000;

type InquiryEmailData = {
  name: string;
  phone: string;
  email: string;
  message: string;
  source: string;
  topic?: string;
  vehicleTitle?: string;
  vehicleSlug?: string;
  price?: string;
  pageUrl?: string;
};

export function hasEmailCredentials() {
  return Boolean(process.env.RESEND_API_KEY?.trim()) && Boolean(getRecipients().length);
}

function getRecipients() {
  return (process.env.INQUIRY_EMAIL_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

// Resend only accepts a From address on a domain verified in the account.
function getSender() {
  return process.env.RESEND_FROM?.trim() || "Carviondealer <onboarding@resend.dev>";
}

function buildSubject(data: InquiryEmailData) {
  const prefix = data.vehicleTitle ? `Vehicle: ${data.vehicleTitle}` : "General Inquiry";
  return `[Inquiry] ${prefix} — ${data.name}`;
}

function buildHtmlBody(data: InquiryEmailData) {
  const rows: string[] = [];

  rows.push(row("Name", esc(data.name)));
  if (data.phone) rows.push(row("Phone", esc(data.phone)));
  if (data.email) rows.push(row("Email", esc(data.email)));
  if (data.vehicleTitle) rows.push(row("Vehicle", esc(data.vehicleTitle)));
  if (data.price) rows.push(row("Price", esc(data.price)));
  if (data.topic) rows.push(row("Topic", esc(data.topic)));
  rows.push(row("Source", esc(data.source)));
  if (data.pageUrl) rows.push(row("Page", `<a href="${esc(data.pageUrl)}">${esc(data.pageUrl)}</a>`));
  if (data.message) rows.push(row("Message", esc(data.message).replace(/\n/g, "<br>")));

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
  <h2 style="margin:0 0 16px;">New Inquiry — Carviondealer</h2>
  <table style="border-collapse:collapse;width:100%;max-width:600px;">
    ${rows.join("\n    ")}
  </table>
</body>
</html>`;
}

function buildTextBody(data: InquiryEmailData) {
  const lines: string[] = ["New Inquiry — Carviondealer", ""];
  lines.push(`Name: ${data.name}`);
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (data.email) lines.push(`Email: ${data.email}`);
  if (data.vehicleTitle) lines.push(`Vehicle: ${data.vehicleTitle}`);
  if (data.price) lines.push(`Price: ${data.price}`);
  if (data.topic) lines.push(`Topic: ${data.topic}`);
  lines.push(`Source: ${data.source}`);
  if (data.pageUrl) lines.push(`Page: ${data.pageUrl}`);
  if (data.message) lines.push(`Message: ${data.message}`);
  return lines.join("\n");
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;">${label}</td><td style="padding:6px 0;">${value}</td></tr>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendInquiryEmail(data: InquiryEmailData) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = getRecipients();

  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (to.length === 0) throw new Error("INQUIRY_EMAIL_TO is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: getSender(),
        to,
        // So hitting Reply in the inbox answers the customer directly.
        ...(data.email ? { reply_to: data.email } : {}),
        subject: buildSubject(data),
        text: buildTextBody(data),
        html: buildHtmlBody(data)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
