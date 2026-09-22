import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  clean,
  isValidThreadId,
  normalizeMessage,
  normalizeThread,
  postChatBridge,
  readJson
} from "@/src/lib/server/chatBridge";

type ContactRouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

type ContactBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: ContactRouteContext) {
  const { threadId } = await context.params;
  if (!isValidThreadId(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }

  const body = await readJson<ContactBody>(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = clean(body.name, 200);
  const phone = clean(body.phone, 80);
  const email = clean(body.email, 200);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }

  try {
    const result = await postChatBridge<{
      thread?: Record<string, unknown>;
      message?: Record<string, unknown>;
    }>("chat.thread.contact.update", {
      threadId,
      name,
      phone,
      email
    });

    return NextResponse.json({
      ok: true,
      thread: normalizeThread(result.data.thread ?? { id: threadId, name, phone, email }, threadId),
      message: result.data.message
        ? normalizeMessage(result.data.message, threadId)
        : undefined
    });
  } catch (error) {
    try {
      const details = [
        `Name: ${name}`,
        phone ? `Phone: ${phone}` : "",
        email ? `Email: ${email}` : ""
      ].filter(Boolean);
      const fallback = await postChatBridge<{ message?: Record<string, unknown> }>(
        "chat.message.create",
        {
          threadId,
          text: `Visitor shared contact details:\n${details.join("\n")}`
        }
      );

      return NextResponse.json({
        ok: true,
        thread: normalizeThread({ id: threadId, name, phone, email }, threadId),
        message: fallback.data.message
          ? normalizeMessage(fallback.data.message, threadId)
          : undefined
      });
    } catch {
      return bridgeErrorResponse(error);
    }
  }
}
