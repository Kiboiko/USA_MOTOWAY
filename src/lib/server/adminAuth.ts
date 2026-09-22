import { NextResponse, type NextRequest } from "next/server";

export const ADMIN_PASSCODE_COOKIE = "carviondealer_live_chat_admin";

export function requireAdmin(request: NextRequest) {
  const expected = normalizePasscode(process.env.LIVE_CHAT_ADMIN_PASSCODE);
  if (!expected) return false;

  const headerToken = normalizePasscode(request.headers.get("x-live-chat-admin-passcode"));
  const cookieToken = normalizePasscode(request.cookies.get(ADMIN_PASSCODE_COOKIE)?.value);
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? normalizePasscode(auth.slice(7)) : "";

  return headerToken === expected || cookieToken === expected || bearer === expected;
}

export function adminUnauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export function normalizePasscode(value: string | null | undefined) {
  return (value ?? "").trim().replace(/(?:\\n)+$/g, "");
}
