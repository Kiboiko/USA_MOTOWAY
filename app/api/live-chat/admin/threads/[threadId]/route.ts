import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  adminOptionsResponse,
  clean,
  isValidThreadId,
  normalizeThread,
  postChatBridge,
  readJson,
  requireAdmin,
  withAdminCors
} from "@/src/lib/server/chatBridge";

type AdminThreadRouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

type UpdateThreadBody = {
  status?: unknown;
};

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return adminOptionsResponse(request);
}

export async function PATCH(request: NextRequest, context: AdminThreadRouteContext) {
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

  const body = await readJson<UpdateThreadBody>(request);
  if (!body) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    );
  }

  const status = clean(body.status, 20);
  if (!["open", "closed"].includes(status)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 })
    );
  }

  try {
    const result = await postChatBridge<{
      thread?: Record<string, unknown>;
    }>("chat.admin.thread.update", {
      threadId,
      status
    });

    return withAdminCors(
      request,
      NextResponse.json({
        ok: true,
        thread: normalizeThread(result.data.thread ?? { id: threadId, status }, threadId)
      })
    );
  } catch (error) {
    return withAdminCors(request, bridgeErrorResponse(error));
  }
}
