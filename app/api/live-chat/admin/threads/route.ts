import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeErrorResponse,
  adminOptionsResponse,
  clean,
  normalizeThread,
  postChatBridge,
  requireAdmin,
  withAdminCors
} from "@/src/lib/server/chatBridge";

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return adminOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return withAdminCors(
      request,
      NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "closed" ? "closed" : "open";

  try {
    const result = await postChatBridge<{
      threads?: Array<Record<string, unknown>>;
    }>("chat.admin.threads.list", {
      status,
      limit: Number(searchParams.get("limit") ?? "50")
    });

    return withAdminCors(
      request,
      NextResponse.json({
        ok: true,
        threads: (result.data.threads ?? []).map((thread) =>
          normalizeThread(thread, clean(thread.id, 120))
        )
      })
    );
  } catch (error) {
    return withAdminCors(request, bridgeErrorResponse(error));
  }
}
