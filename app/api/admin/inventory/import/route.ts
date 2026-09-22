import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { adminUnauthorized, requireAdmin } from "@/src/lib/server/adminAuth";
import { appendInventoryVehicles, writeAsset } from "@/src/lib/server/inventoryStore";
import type { Vehicle, VehicleImage, VehicleStatus } from "@/src/lib/vehicles";
import {
  buildVehicleDraft,
  imageContentType,
  naturalSort,
  readImageSize,
  slugify
} from "@/src/lib/vehicleImport";

type ZipEntry = {
  name: string;
  bytes: Buffer;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) return adminUnauthorized();

  const form = await request.formData();
  const archive = form.get("archive");
  const rawStatus = form.get("status");
  const status: VehicleStatus = rawStatus === "sold" ? "sold" : "available";

  if (!(archive instanceof File)) {
    return NextResponse.json({ ok: false, error: "Upload a .zip archive" }, { status: 400 });
  }

  const zip = await JSZip.loadAsync(Buffer.from(await archive.arrayBuffer()));
  const entries: ZipEntry[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || name.includes("__MACOSX/") || name.endsWith(".DS_Store")) continue;
    entries.push({
      name,
      bytes: Buffer.from(await entry.async("uint8array"))
    });
  }

  const vehicles = await buildVehiclesFromEntries(entries, status);
  if (vehicles.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No vehicle folders with images were found in that zip" },
      { status: 400 }
    );
  }

  const nextInventory = await appendInventoryVehicles(vehicles);
  return NextResponse.json({
    ok: true,
    imported: vehicles.length,
    vehicles,
    inventoryCount: nextInventory.length
  });
}

async function buildVehiclesFromEntries(entries: ZipEntry[], status: VehicleStatus) {
  const groups = new Map<string, ZipEntry[]>();

  for (const entry of entries) {
    const parts = entry.name.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    const folder = parts.length > 1 ? parts[0] : "Imported vehicle";
    groups.set(folder, [...(groups.get(folder) ?? []), { ...entry, name: parts.at(-1) ?? entry.name }]);
  }

  const vehicles: Vehicle[] = [];
  for (const [folderName, files] of groups.entries()) {
    const imageFiles = files
      .filter((file) => /\.(jpe?g|png)$/i.test(file.name))
      .sort((a, b) => naturalSort(a.name, b.name));
    if (imageFiles.length === 0) continue;

    const specText = readTextFile(files, ["s.txt", "specs.txt", "spec.txt"]);
    const descriptionText = readTextFile(files, ["o.txt", "overview.txt", "t.txt", "text.txt"]);
    const draft = buildVehicleDraft({ folderName, specText, descriptionText, status });
    const slug = slugify(draft.slug);
    const images: VehicleImage[] = [];

    for (const [index, image] of imageFiles.entries()) {
      const size = readImageSize(image.bytes, image.name);
      const filename = `${String(index + 1).padStart(2, "0")}.${size.extension}`;
      const src = await writeAsset(slug, filename, image.bytes, imageContentType(filename));
      images.push({
        src,
        alt: `${draft.title} photo ${index + 1}`,
        width: size.width,
        height: size.height
      });
    }

    vehicles.push({
      ...draft,
      slug,
      images
    });
  }

  return vehicles;
}

function readTextFile(files: ZipEntry[], candidates: string[]) {
  const found = files.find((file) => candidates.includes(file.name.toLowerCase()));
  return found ? found.bytes.toString("utf8").replace(/\s+/g, " ").trim() : "";
}
