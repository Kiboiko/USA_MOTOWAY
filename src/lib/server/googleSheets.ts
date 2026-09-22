import "server-only";

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Minimal Google Sheets v4 client for appending rows with a service account.
// Implemented directly against the REST API so the project keeps its small
// dependency footprint (no googleapis / google-auth-library).

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const REQUEST_TIMEOUT_MS = 10000;

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let credentialsPromise: Promise<ServiceAccount | null> | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
// Numeric sheet ids, keyed by `${spreadsheetId}:${sheetName}`. A cached entry
// also means the tab exists and carries its header row.
const sheetIds = new Map<string, number>();

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Accepts either the raw JSON (optionally base64-encoded) in
// GOOGLE_SERVICE_ACCOUNT_JSON, or a path in GOOGLE_APPLICATION_CREDENTIALS.
async function loadCredentials(): Promise<ServiceAccount | null> {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const text = inline.startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8");
    return normalizeCredentials(JSON.parse(text));
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!path) return null;

  const resolved = isAbsolute(path) ? path : join(process.cwd(), path);
  return normalizeCredentials(JSON.parse(await readFile(resolved, "utf8")));
}

function normalizeCredentials(raw: Partial<ServiceAccount>): ServiceAccount | null {
  if (!raw?.client_email || !raw?.private_key) return null;
  return {
    client_email: raw.client_email,
    // Env-var copies usually carry literal "\n" instead of real newlines.
    private_key: raw.private_key.replace(/\\n/g, "\n"),
    token_uri: raw.token_uri || TOKEN_URI
  };
}

function getCredentials() {
  if (!credentialsPromise) {
    credentialsPromise = loadCredentials().catch(() => null);
  }
  return credentialsPromise;
}

export function getLeadsSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID?.trim() ?? "";
}

export function getLeadsSheetName() {
  return process.env.GOOGLE_SHEETS_LEADS_TAB?.trim() || "Leads";
}

export async function hasSheetsCredentials() {
  return Boolean(getLeadsSpreadsheetId()) && Boolean(await getCredentials());
}

async function getAccessToken(): Promise<string> {
  // Reuse the token until a minute before it lapses.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const credentials = await getCredentials();
  if (!credentials) throw new Error("Google service-account credentials are not configured");

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SCOPE,
      aud: credentials.token_uri,
      iat: issuedAt,
      exp: issuedAt + 3600
    })
  );

  const signature = base64url(
    createSign("RSA-SHA256").update(`${header}.${claim}`).sign(credentials.private_key)
  );

  const response = await fetchWithTimeout(credentials.token_uri!, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`
    })
  });

  const payload = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google token request failed: ${payload.error_description ?? response.status}`);
  }

  cachedToken = { value: payload.access_token, expiresAt: Date.now() + 3600_000 };
  return payload.access_token;
}

async function sheetsRequest(path: string, init: RequestInit) {
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets ${response.status}: ${detail.slice(0, 400)}`);
  }

  return response.json();
}

// Creates the tab (with a header row) the first time it is needed, so a fresh
// spreadsheet works without manual setup.
async function ensureSheet(spreadsheetId: string, sheetName: string, header: string[]) {
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  const cached = sheetIds.get(cacheKey);
  if (cached !== undefined) return cached;

  const meta = (await sheetsRequest(
    `/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { method: "GET" }
  )) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };

  let sheetId = meta.sheets?.find((sheet) => sheet.properties?.title === sheetName)?.properties
    ?.sheetId;

  if (sheetId === undefined) {
    const created = (await sheetsRequest(`/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
    })) as { replies?: { addSheet?: { properties?: { sheetId?: number } } }[] };

    sheetId = created.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId === undefined) throw new Error(`Could not resolve the "${sheetName}" tab`);
  }

  // Also covers a tab the operator created by hand but left empty, so the
  // first lead never ends up sitting in row 1 without column names.
  const firstRow = (await sheetsRequest(
    `/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:A1`)}`,
    { method: "GET" }
  )) as { values?: string[][] };

  if (!firstRow.values?.length) {
    await sheetsRequest(
      `/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [header] }) }
    );
  }

  sheetIds.set(cacheKey, sheetId);
  return sheetId;
}

export async function appendLeadRow(row: (string | number)[], header: string[]) {
  const spreadsheetId = getLeadsSpreadsheetId();
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not configured");

  const sheetName = getLeadsSheetName();
  const sheetId = await ensureSheet(spreadsheetId, sheetName, header);

  // appendCells, not values.append. values.append re-derives a "table" from the
  // current shape of the data on every call, so one stray block left below the
  // leads makes it guess a different first column and the whole row lands
  // offset — that is exactly how two leads ended up five columns to the right.
  // appendCells has no such guessing: it always starts at column A, on the row
  // after the last one with data, and never overwrites an existing cell.
  //
  // stringValue (rather than a RAW values write) also pins every field as
  // literal text, so a visitor's "+1 555…" stays a phone number and a typed
  // "=IMPORTXML(...)" can never execute as a formula.
  await sheetsRequest(`/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          appendCells: {
            sheetId,
            fields: "userEnteredValue",
            rows: [
              {
                values: row.map((value) => ({
                  userEnteredValue: { stringValue: String(value) }
                }))
              }
            ]
          }
        }
      ]
    })
  });
}
