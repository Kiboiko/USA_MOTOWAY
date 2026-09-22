import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export type ChatSender = "visitor" | "operator" | "system";

export type ChatMessage = {
  id: string;
  threadId: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  status: "open" | "closed";
  topic: string;
  name: string;
  phone: string;
  email: string;
  pageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatBridgeResponse<T> = {
  ok: true;
  data: T;
};

const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_LENGTH = 240;
const THREAD_ID_PATTERN = /^[a-zA-Z0-9_-]{12,80}$/;
const ADMIN_PASSCODE_COOKIE = "carviondealer_live_chat_admin";
const ADMIN_CORS_ORIGINS = new Set([
  "https://carviondealer.com",
  "https://www.carviondealer.com"
]);

export function clean(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function isValidThreadId(threadId: string) {
  return THREAD_ID_PATTERN.test(threadId);
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function adminOptionsResponse(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: adminCorsHeaders(request)
  });
}

export function withAdminCors(request: NextRequest, response: NextResponse) {
  for (const [key, value] of Object.entries(adminCorsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}

export function requireAdmin(request: NextRequest) {
  const expected = normalizeAdminPasscode(process.env.LIVE_CHAT_ADMIN_PASSCODE);
  if (!expected) return false;

  const headerToken = normalizeAdminPasscode(request.headers.get("x-live-chat-admin-passcode"));
  const cookieToken = normalizeAdminPasscode(request.cookies.get(ADMIN_PASSCODE_COOKIE)?.value);
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? normalizeAdminPasscode(auth.slice(7))
    : "";

  return headerToken === expected || cookieToken === expected || bearer === expected;
}

function normalizeAdminPasscode(value: string | null | undefined) {
  return (value ?? "").trim().replace(/(?:\\n)+$/g, "");
}

function adminCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = ADMIN_CORS_ORIGINS.has(origin) ? origin : "https://carviondealer.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-live-chat-admin-passcode, authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}

export function readClientMeta(request: NextRequest) {
  return {
    referrer: clean(request.headers.get("referer"), 500),
    userAgent: clean(request.headers.get("user-agent"), 500)
  };
}

export async function readJson<T>(request: NextRequest) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function postChatBridge<T>(
  action: string,
  payload: Record<string, unknown>
): Promise<ChatBridgeResponse<T>> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || process.env.GOOGLE_LEADS_WEBHOOK_URL;
  const webhookToken = process.env.GOOGLE_LEADS_WEBHOOK_TOKEN;

  if (!webhookUrl || !webhookToken) {
    throw new ChatBridgeError("Live chat is not configured", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        token: webhookToken,
        action,
        receivedAt: new Date().toISOString(),
        ...payload
      }),
      signal: controller.signal
    });

    const text = await response.text();
    const parsed = safeJson(text) as ChatBridgeResponse<T> | { ok?: unknown; error?: unknown } | null;

    if (!response.ok || !parsed || parsed.ok !== true) {
      throw new ChatBridgeError("Live chat storage failed", 502);
    }

    const data = (parsed as { data?: unknown }).data;
    if (!data || typeof data !== "object") {
      throw new ChatBridgeError("Live chat storage failed", 502);
    }

    return {
      ok: true,
      data: data as T
    };
  } catch (error) {
    if (error instanceof ChatBridgeError) throw error;
    throw new ChatBridgeError("Live chat storage failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function bridgeErrorResponse(error: unknown) {
  if (error instanceof ChatBridgeError) {
    return jsonError(error.message, error.status);
  }
  return jsonError("Live chat failed", 502);
}

export function normalizeThread(raw: Partial<ChatThread>, fallbackId = newId("chat")): ChatThread {
  const now = new Date().toISOString();
  return {
    id: clean(raw.id, MAX_SHORT_LENGTH) || fallbackId,
    status: raw.status === "closed" ? "closed" : "open",
    topic: clean(raw.topic, MAX_SHORT_LENGTH),
    name: clean(raw.name, MAX_SHORT_LENGTH),
    phone: clean(raw.phone, MAX_SHORT_LENGTH),
    email: clean(raw.email, MAX_SHORT_LENGTH),
    pageUrl: clean(raw.pageUrl, 500),
    createdAt: clean(raw.createdAt, MAX_SHORT_LENGTH) || now,
    updatedAt: clean(raw.updatedAt, MAX_SHORT_LENGTH) || now
  };
}

export function normalizeMessage(raw: Partial<ChatMessage>, threadId: string): ChatMessage {
  return {
    id: clean(raw.id, MAX_SHORT_LENGTH) || newId("msg"),
    threadId: clean(raw.threadId, MAX_SHORT_LENGTH) || threadId,
    sender: raw.sender === "operator" || raw.sender === "system" ? raw.sender : "visitor",
    text: clean(raw.text),
    createdAt: clean(raw.createdAt, MAX_SHORT_LENGTH) || new Date().toISOString()
  };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class ChatBridgeError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}
