import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import {
  deleteInventoryVehicle,
  getManagedVehicle,
  saveInventoryVehicle
} from "@/src/lib/server/inventoryStore";

type InventoryItemContext = {
  params: Promise<{
    slug: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: InventoryItemContext) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { slug } = await context.params;
  const current = await getManagedVehicle(slug);
  if (!current) return NextResponse.json({ ok: false, error: "Vehicle not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const vehicle = await saveInventoryVehicle({ ...current, ...(body as object), slug });
  return NextResponse.json({ ok: true, vehicle });
}

export async function DELETE(request: NextRequest, context: InventoryItemContext) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { slug } = await context.params;
  await deleteInventoryVehicle(slug);
  return NextResponse.json({ ok: true });
}
