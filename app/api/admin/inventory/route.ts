import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import {
  getManagedVehicles,
  hasPersistentBlobStorage,
  saveInventoryVehicle
} from "@/src/lib/server/inventoryStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return adminUnauthorized();

  return NextResponse.json({
    ok: true,
    storage: hasPersistentBlobStorage() ? "vercel-blob" : "local-dev",
    vehicles: await getManagedVehicles()
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

  if (!body || typeof body !== "object" || !("title" in body)) {
    return NextResponse.json({ ok: false, error: "Vehicle title is required" }, { status: 400 });
  }

  const vehicle = await saveInventoryVehicle(body as Parameters<typeof saveInventoryVehicle>[0]);
  return NextResponse.json({ ok: true, vehicle });
}
