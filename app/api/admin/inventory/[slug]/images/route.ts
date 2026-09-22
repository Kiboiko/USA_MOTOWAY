import { NextResponse, type NextRequest } from "next/server";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import { saveVehicleImages } from "@/src/lib/server/inventoryStore";

type ImageRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: ImageRouteContext) {
  if (!requireAdmin(request)) return adminUnauthorized();
  const { slug } = await context.params;
  const form = await request.formData();
  const files = form.getAll("images").filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Upload at least one image" }, { status: 400 });
  }

  const vehicle = await saveVehicleImages(
    slug,
    await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        contentType: file.type,
        bytes: Buffer.from(await file.arrayBuffer())
      }))
    )
  );

  return NextResponse.json({ ok: true, vehicle });
}
