import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  adminOptionsResponse,
  clean,
  isValidThreadId,
  newId,
  normalizeMessage,
  postChatBridge,
  readJson,
  requireAdmin,
  withAdminCors
} from "@/src/lib/server/chatBridge";

type AdminMessageRouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

type AdminMessageBody = {
  text?: unknown;
};

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return adminOptionsResponse(request);
}

export async function GET(request: NextRequest, context: AdminMessageRouteContext) {
  if (!requireAdmin(request)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    );
  }

  const { threadId } = await context.params;
  if (!isValidThreadId(threadId)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 })
    );
  }

  const { searchParams } = new URL(request.url);
  const since = clean(searchParams.get("since"), 120);

  try {
    const result = await postChatBridge<{
      messages?: Array<Record<string, unknown>>;
      nextCursor?: string;
      status?: string;
    }>("chat.admin.messages.list", {
      threadId,
      since
    });

    return withAdminCors(
      request,
      NextResponse.json({
        ok: true,
        threadId,
        status: result.data.status === "closed" ? "closed" : "open",
        messages: (result.data.messages ?? []).map((message) =>
          normalizeMessage(message, threadId)
        ),
        nextCursor: clean(result.data.nextCursor, 120)
      })
    );
  } catch (error) {
    return withAdminCors(request, bridgeErrorResponse(error));
  }
}

export async function POST(request: NextRequest, context: AdminMessageRouteContext) {
  if (!requireAdmin(request)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    );
  }

  const { threadId } = await context.params;
  if (!isValidThreadId(threadId)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 })
    );
  }

  const body = await readJson<AdminMessageBody>(request);
  if (!body) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    );
  }

  const text = clean(body.text);
  if (!text) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 })
    );
  }

  try {
    const result = await postChatBridge<{
      message?: Record<string, unknown>;
    }>("chat.admin.message.create", {
      threadId,
      messageId: newId("msg"),
      sender: "operator",
      text
    });

    return withAdminCors(
      request,
      NextResponse.json({
        ok: true,
        message: normalizeMessage(result.data.message ?? { text, sender: "operator" }, threadId)
      })
    );
  } catch (error) {
    return withAdminCors(request, bridgeErrorResponse(error));
  }
}
