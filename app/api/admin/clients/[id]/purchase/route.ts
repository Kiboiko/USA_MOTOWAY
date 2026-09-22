import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import { getClient, mutateClient } from "@/src/lib/server/clientStore";
import { sendMetaPurchase } from "@/src/lib/server/metaConversions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// Guards against a double click reporting one sale twice while the first
// request is still waiting on Meta.
const inFlight = new Set<string>();

/**
 * Marks the client as bought and reports a Purchase event to Meta.
 * Calling it again after a failed report retries; after a successful one it
 * does nothing, so a sale can never be counted twice.
 */
export async function POST(request: NextRequest, context: Context) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { id } = await context.params;

  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
  if (!existing.price) {
    return NextResponse.json(
      { ok: false, error: "Enter the sale price first — Meta needs the purchase value." },
      { status: 400 }
    );
  }
  if (inFlight.has(id)) {
    return NextResponse.json({ ok: false, error: "This purchase is already being sent." }, { status: 409 });
  }

  inFlight.add(id);
  try {
    const bought = await mutateClient(id, (current) => ({
      ...current,
      status: "purchased",
      purchasedAt: current.purchasedAt ?? new Date().toISOString()
    }));
    if (!bought) return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });

    if (bought.metaPurchase?.ok) {
      return NextResponse.json({ ok: true, client: bought, alreadySent: true });
    }

    const log = await sendMetaPurchase(bought);
    if (!log.ok) console.error(`[clients] Meta Purchase failed for ${id}: ${log.error}`);

    const client = await mutateClient(id, (current) => ({ ...current, metaPurchase: log }));
    return NextResponse.json({ ok: true, client: client ?? bought });
  } finally {
    inFlight.delete(id);
  }
}
