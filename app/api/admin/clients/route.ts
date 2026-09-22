import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import { ClientInputError, createClient, listClients } from "@/src/lib/server/clientStore";
import { hasMetaCapiCredentials } from "@/src/lib/server/metaConversions";
import type { ClientInput } from "@/src/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return adminUnauthorized();

  return NextResponse.json({
    ok: true,
    metaConfigured: hasMetaCapiCredentials(),
    metaTestMode: Boolean(process.env.META_CAPI_TEST_EVENT_CODE),
    clients: await listClients()
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) return adminUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid client" }, { status: 400 });
  }

  try {
    const client = await createClient(body as ClientInput);
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    if (error instanceof ClientInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
}
