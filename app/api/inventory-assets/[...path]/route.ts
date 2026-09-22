import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { NextResponse } from "next/server";

type AssetContext = {
  params: Promise<{
    path: string[];
  }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: AssetContext) {
  const { path } = await context.params;
  const safePath = normalize(path.join("/")).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(process.cwd(), ".inventory-data", "assets", safePath);

  try {
    const bytes = await readFile(filePath);
    const contentType = filePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(bytes, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
