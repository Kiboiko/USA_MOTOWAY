import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  clean,
  isValidThreadId,
  newId,
  normalizeMessage,
  postChatBridge,
  readClientMeta,
  readJson
} from "@/src/lib/server/chatBridge";

type MessageRouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

type CreateMessageBody = {
  text?: unknown;
  pageUrl?: unknown;
};

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: MessageRouteContext) {
  const { threadId } = await context.params;
  if (!isValidThreadId(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const since = clean(searchParams.get("since"), 120);

  try {
    const result = await postChatBridge<{
      messages?: Array<Record<string, unknown>>;
      nextCursor?: string;
      status?: string;
    }>("chat.messages.list", {
      threadId,
      since,
      ...readClientMeta(request)
    });

    return NextResponse.json({
      ok: true,
      threadId,
      status: result.data.status === "closed" ? "closed" : "open",
      messages: (result.data.messages ?? []).map((message) => normalizeMessage(message, threadId)),
      nextCursor: clean(result.data.nextCursor, 120)
    });
  } catch (error) {
    return bridgeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: MessageRouteContext) {
  const { threadId } = await context.params;
  if (!isValidThreadId(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }

  const body = await readJson<CreateMessageBody>(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const text = clean(body.text);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
  }

  try {
    const result = await postChatBridge<{
      message?: Record<string, unknown>;
    }>("chat.message.create", {
      threadId,
      messageId: newId("msg"),
      sender: "visitor",
      text,
      pageUrl: clean(body.pageUrl, 500),
      ...readClientMeta(request)
    });

    return NextResponse.json({
      ok: true,
      message: normalizeMessage(result.data.message ?? { text, sender: "visitor" }, threadId)
    });
  } catch (error) {
    return bridgeErrorResponse(error);
  }
}
