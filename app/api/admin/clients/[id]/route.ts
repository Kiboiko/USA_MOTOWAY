import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import { ClientInputError, deleteClient, updateClient } from "@/src/lib/server/clientStore";
import type { ClientInput } from "@/src/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { id } = await context.params;

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
    const client = await updateClient(id, body as ClientInput);
    if (!client) return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    if (error instanceof ClientInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { id } = await context.params;

  const deleted = await deleteClient(id);
  if (!deleted) return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
