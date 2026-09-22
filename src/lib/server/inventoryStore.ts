import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { list, put } from "@vercel/blob";
import { vehicles as generatedVehicles } from "@/src/data/vehicles.generated";
import type { Vehicle, VehicleImage, VehicleStatus } from "@/src/lib/vehicles";
import {
  cleanString,
  imageContentType,
  naturalSort,
  parseInteger,
  parsePrice,
  readImageSize,
  slugify,
  vehicleSummary
} from "@/src/lib/vehicleImport";

const INVENTORY_JSON_PATH = "admin/inventory.json";
const LOCAL_DATA_FILE = join(process.cwd(), ".inventory-data", "inventory.json");
const LOCAL_ASSET_DIR = join(process.cwd(), ".inventory-data", "assets");

export type InventorySaveInput = Partial<Vehicle> & {
  title: string;
  make?: string;
  model?: string;
  status?: VehicleStatus;
};

export function hasPersistentBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function getManagedVehicles(): Promise<Vehicle[]> {
  const saved = hasPersistentBlobStorage() ? await readBlobInventory() : await readLocalInventory();
  return normalizeInventory(saved ?? generatedVehicles);
}

export async function getManagedVehicle(slug: string): Promise<Vehicle | undefined> {
  return (await getManagedVehicles()).find((vehicle) => vehicle.slug === slug);
}

export async function getManagedAvailableVehicles() {
  const vehicles = (await getManagedVehicles()).filter((vehicle) => vehicle.status === "available");
  const demoted = new Set<string>(["2018-mercedes-amg-gls63-4matic"]);
  return [
    ...vehicles.filter((vehicle) => !demoted.has(vehicle.slug)),
    ...vehicles.filter((vehicle) => demoted.has(vehicle.slug))
  ];
}

export async function getManagedSoldVehicles() {
  return (await getManagedVehicles()).filter((vehicle) => vehicle.status === "sold");
}

export async function saveInventoryVehicle(input: InventorySaveInput) {
  const vehicles = await getManagedVehicles();
  const nextVehicle = normalizeVehicleInput(input);
  const next = upsertVehicle(vehicles, nextVehicle);
  await writeInventory(next);
  return nextVehicle;
}

export async function deleteInventoryVehicle(slug: string) {
  const vehicles = await getManagedVehicles();
  const next = vehicles.filter((vehicle) => vehicle.slug !== slug);
  await writeInventory(next);
  return next;
}

export async function replaceInventoryVehicles(vehicles: Vehicle[]) {
  const normalized = normalizeInventory(vehicles);
  await writeInventory(normalized);
  return normalized;
}

export async function appendInventoryVehicles(incoming: Vehicle[]) {
  let vehicles = await getManagedVehicles();
  for (const vehicle of normalizeInventory(incoming)) {
    vehicles = upsertVehicle(vehicles, vehicle);
  }
  await writeInventory(vehicles);
  return vehicles;
}

export async function saveVehicleImages(slug: string, files: Array<{ filename: string; bytes: Buffer; contentType?: string }>) {
  const vehicles = await getManagedVehicles();
  const vehicle = vehicles.find((item) => item.slug === slug);
  if (!vehicle) throw new Error("Vehicle not found");

  const existingCount = vehicle.images.length;
  const images: VehicleImage[] = [];
  for (const [index, file] of files.entries()) {
    const size = readImageSize(file.bytes, file.filename);
    const outputName = `${String(existingCount + index + 1).padStart(2, "0")}.${size.extension}`;
    const src = await writeAsset(slug, outputName, file.bytes, file.contentType ?? imageContentType(outputName));
    images.push({
      src,
      alt: `${vehicle.title} photo ${existingCount + index + 1}`,
      width: size.width,
      height: size.height
    });
  }

  const updated = { ...vehicle, images: [...vehicle.images, ...images] };
  await writeInventory(upsertVehicle(vehicles, updated));
  return updated;
}

export async function writeAsset(slug: string, filename: string, bytes: Buffer, contentType: string) {
  const safeSlug = slugify(slug);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");

  if (hasPersistentBlobStorage()) {
    const blob = await put(`inventory/${safeSlug}/${safeName}`, bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: 60
    });
    return blob.url;
  }

  const filePath = join(LOCAL_ASSET_DIR, safeSlug, safeName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return `/api/inventory-assets/${safeSlug}/${safeName}`;
}

async function writeInventory(vehicles: Vehicle[]) {
  const normalized = normalizeInventory(vehicles);

  if (hasPersistentBlobStorage()) {
    await put(INVENTORY_JSON_PATH, JSON.stringify(normalized, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
    return;
  }

  await mkdir(dirname(LOCAL_DATA_FILE), { recursive: true });
  await writeFile(LOCAL_DATA_FILE, JSON.stringify(normalized, null, 2));
}

async function readBlobInventory() {
  try {
    const found = await list({ prefix: INVENTORY_JSON_PATH, limit: 10 });
    const blob = found.blobs.find((item) => item.pathname === INVENTORY_JSON_PATH);
    if (!blob) return null;
    const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Vehicle[];
  } catch {
    return null;
  }
}

async function readLocalInventory() {
  try {
    return JSON.parse(await readFile(LOCAL_DATA_FILE, "utf8")) as Vehicle[];
  } catch {
    return null;
  }
}

function upsertVehicle(vehicles: Vehicle[], vehicle: Vehicle) {
  const existingIndex = vehicles.findIndex((item) => item.slug === vehicle.slug);
  if (existingIndex === -1) return [vehicle, ...vehicles];
  const next = [...vehicles];
  next[existingIndex] = vehicle;
  return next;
}

function normalizeInventory(vehicles: Vehicle[]) {
  return vehicles.map((vehicle) => normalizeVehicleInput(vehicle)).sort((a, b) => {
    if (a.status !== b.status) return a.status === "available" ? -1 : 1;
    return naturalSort(a.title, b.title);
  });
}

function normalizeVehicleInput(input: InventorySaveInput): Vehicle {
  const title = cleanString(input.title || "Untitled vehicle", 240);
  const slug = cleanString(input.slug, 160) || slugify(title);
  const description = cleanString(input.description) || `${title} is listed by Carviondealer.`;
  const make = cleanString(input.make, 120) || "Vehicle";
  const model = cleanString(input.model, 160) || title;
  const parsedPrice = parsePrice(input.price);
  const vehicle: Vehicle = {
    slug,
    title,
    year: parseInteger(input.year),
    make,
    model,
    trim: cleanString(input.trim, 160) || undefined,
    bodyType: cleanString(input.bodyType, 120) || undefined,
    drivetrain: cleanString(input.drivetrain, 160) || undefined,
    engine: cleanString(input.engine, 200) || undefined,
    exteriorColor: cleanString(input.exteriorColor, 160) || undefined,
    interiorColor: cleanString(input.interiorColor, 160) || undefined,
    description,
    summary: cleanString(input.summary, 240) || vehicleSummary({ title, make, model }, description),
    features: Array.isArray(input.features)
      ? input.features.map((feature) => cleanString(feature, 120)).filter(Boolean)
      : [],
    images: Array.isArray(input.images) ? input.images.map(normalizeVehicleImage) : [],
    status: input.status === "sold" ? "sold" : "available",
    price: parsedPrice,
    currency: parsedPrice !== undefined ? input.currency ?? "USD" : undefined,
    vin: cleanString(input.vin, 120) || undefined,
    stockNumber: cleanString(input.stockNumber, 120) || undefined,
    mileage: parseInteger(input.mileage),
    horsepower: parseInteger(input.horsepower),
    cylinders: parseInteger(input.cylinders),
    transmission: cleanString(input.transmission, 160) || undefined,
    fuelType: cleanString(input.fuelType, 120) || undefined,
    condition: cleanString(input.condition, 120) || undefined
  };

  for (const key of Object.keys(vehicle) as Array<keyof Vehicle>) {
    if (vehicle[key] === undefined) delete vehicle[key];
  }

  return vehicle;
}

function normalizeVehicleImage(image: VehicleImage): VehicleImage {
  if (!image.src.startsWith("/inventory/")) return image;
  return {
    ...image,
    src: image.src.replace(/\.png$/i, ".jpg")
  };
}
