import type { NextRequest } from "next/server";

type TurnstileResponse = {
  success?: boolean;
};

export async function verifyTurnstileToken(request: NextRequest, token: string) {
  if (process.env.TURNSTILE_ENABLED !== "true") return true;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);

  const remoteIp = getRemoteIp(request);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form
    });

    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResponse;
    return result.success === true;
  } catch {
    return false;
  }
}

function getRemoteIp(request: NextRequest) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return "";
  return forwardedFor.split(",")[0]?.trim() ?? "";
}
