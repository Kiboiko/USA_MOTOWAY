import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  clean,
  newId,
  normalizeMessage,
  normalizeThread,
  postChatBridge,
  readClientMeta,
  readJson
} from "@/src/lib/server/chatBridge";

type CreateSessionBody = {
  topic?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  pageUrl?: unknown;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readJson<CreateSessionBody>(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const threadId = newId("chat");
  const initialMessage = clean(body.message);

  try {
    const result = await postChatBridge<{
      thread?: Record<string, unknown>;
      messages?: Array<Record<string, unknown>>;
    }>("chat.session.create", {
      threadId,
      topic: clean(body.topic, 120),
      name: clean(body.name, 200),
      phone: clean(body.phone, 80),
      email: clean(body.email, 200),
      message: initialMessage,
      pageUrl: clean(body.pageUrl, 500),
      ...readClientMeta(request)
    });

    const thread = normalizeThread(result.data.thread ?? { id: threadId }, threadId);
    const messages = (result.data.messages ?? []).map((message) => normalizeMessage(message, thread.id));

    return NextResponse.json({
      ok: true,
      thread,
      messages
    });
  } catch (error) {
    return bridgeErrorResponse(error);
  }
}
