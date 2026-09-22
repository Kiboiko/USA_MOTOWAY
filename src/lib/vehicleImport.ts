import type { Vehicle, VehicleImage, VehicleStatus } from "@/src/lib/vehicles";

export type ImportedImage = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type ImportedVehicleDraft = Omit<Vehicle, "images"> & {
  images?: VehicleImage[];
};

const SPEC_KEYS = new Set([
  "price",
  "stock#",
  "stock #",
  "stock",
  "year",
  "make",
  "model",
  "trim",
  "vin",
  "engine",
  "hp",
  "horsepower",
  "transmission",
  "mileage",
  "miles",
  "fuel type",
  "fuel",
  "body",
  "body type",
  "condition",
  "cylinders",
  "exterior color",
  "interior color",
  "drivetrain",
  "drive",
  "drive type"
]);

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function cleanString(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function parseInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number.parseInt(String(value).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parsePrice(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number.parseFloat(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function readImageSize(bytes: Buffer, filename = "") {
  if (bytes.length >= 24 && bytes.toString("ascii", 1, 4) === "PNG") {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      extension: "png"
    };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5),
          extension: "jpg"
        };
      }
      offset += 2 + length;
    }
  }

  const extension = filename.toLowerCase().endsWith(".png") ? "png" : "jpg";
  return { width: 1200, height: 800, extension };
}

export function imageContentType(filename: string) {
  return filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export function normalizeSpecKey(line: string) {
  return line.replace(/[:：]\s*$/, "").trim().toLowerCase();
}

export function parseSpecText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const specs: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const key = normalizeSpecKey(lines[i]);
    if (!SPEC_KEYS.has(key)) continue;
    const value = lines[i + 1];
    if (value && !SPEC_KEYS.has(normalizeSpecKey(value))) {
      specs[key] = value;
      i += 1;
    }
  }
  return specs;
}

export function inferVehicleFromFolder(folderName: string) {
  const match = folderName.match(/^(\d{4})\s+([A-Za-z-]+)\s+(.+)$/);
  if (!match) {
    return {
      title: folderName,
      year: new Date().getFullYear(),
      make: "Vehicle",
      model: folderName
    };
  }

  return {
    title: folderName,
    year: Number(match[1]),
    make: match[2],
    model: match[3]
  };
}

function specCleanString(value: unknown) {
  const trimmed = cleanString(value, 500);
  if (!trimmed || trimmed.toLowerCase() === "n/a") return undefined;
  return trimmed;
}

export function featureList(vehicle: Partial<Vehicle>, description: string) {
  const features = [];
  if (vehicle.engine) features.push(vehicle.engine);
  if (vehicle.drivetrain) features.push(vehicle.drivetrain);
  if (vehicle.exteriorColor) features.push(vehicle.exteriorColor);
  if (vehicle.interiorColor) features.push(vehicle.interiorColor);
  if (/clean carfax/i.test(description)) features.push("Clean Carfax");
  if (/carbon/i.test(description)) features.push("Carbon fiber package");
  if (/super cruise/i.test(description)) features.push("Super Cruise");
  if (/panoramic/i.test(description)) features.push("Panoramic roof");
  return [...new Set(features)].slice(0, 8);
}

export function seoSummary(description: string, maxLength = 160) {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= maxLength) return sentence;

  const slice = text.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return slice.slice(0, lastSpace > 80 ? lastSpace : maxLength).trimEnd();
}

export function vehicleSummary(vehicle: Partial<Vehicle>, description: string) {
  const details = [
    vehicle.engine,
    vehicle.drivetrain?.toLowerCase(),
    vehicle.exteriorColor ? `${vehicle.exteriorColor} exterior` : undefined,
    vehicle.interiorColor ? `${vehicle.interiorColor} interior` : undefined
  ].filter(Boolean);

  if (details.length > 0) {
    const full = `${vehicle.title} with ${details.slice(0, -1).join(", ")}${
      details.length > 1 ? ", and " : ""
    }${details.at(-1)}.`;
    if (full.length <= 160) return full;

    return `${vehicle.title} with ${details.slice(0, 3).join(", ")}.`;
  }

  return seoSummary(description);
}

export function buildVehicleDraft({
  folderName,
  specText,
  descriptionText,
  status = "available"
}: {
  folderName: string;
  specText?: string;
  descriptionText?: string;
  status?: VehicleStatus;
}): ImportedVehicleDraft {
  const specs = specText ? parseSpecText(specText) : {};
  const inferred = inferVehicleFromFolder(folderName);
  const year = parseInteger(specs.year) ?? inferred.year;
  const make = specCleanString(specs.make) ?? inferred.make;
  const model = specCleanString(specs.model) ?? inferred.model;
  const title = year ? `${year} ${make} ${model}` : `${make} ${model}`;
  const description =
    cleanString(descriptionText) || `This ${title} is listed by Carviondealer.`;

  const draft: ImportedVehicleDraft = {
    slug: slugify(title),
    title,
    year,
    make,
    model,
    trim: specCleanString(specs.trim),
    bodyType: specCleanString(specs.body ?? specs["body type"]),
    drivetrain: specCleanString(specs.drivetrain ?? specs.drive ?? specs["drive type"]),
    engine: specCleanString(specs.engine),
    exteriorColor: specCleanString(specs["exterior color"]),
    interiorColor: specCleanString(specs["interior color"]),
    description,
    summary: vehicleSummary({ title, engine: specs.engine }, description),
    features: [],
    images: [],
    status,
    price: parsePrice(specs.price),
    currency: parsePrice(specs.price) !== undefined ? "USD" : undefined,
    vin: specCleanString(specs.vin),
    stockNumber: specCleanString(specs["stock#"] ?? specs["stock #"] ?? specs.stock),
    mileage: parseInteger(specs.mileage ?? specs.miles),
    horsepower: parseInteger(specs.hp ?? specs.horsepower),
    cylinders: parseInteger(specs.cylinders),
    transmission: specCleanString(specs.transmission),
    fuelType: specCleanString(specs["fuel type"] ?? specs.fuel),
    condition: specCleanString(specs.condition)
  };

  draft.summary = vehicleSummary(draft, description);
  draft.features = featureList(draft, description);

  for (const key of Object.keys(draft) as Array<keyof ImportedVehicleDraft>) {
    if (draft[key] === undefined) delete draft[key];
  }

  return draft;
}
