import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const root = process.cwd();
const outputFile = join(root, "src", "data", "vehicles.generated.ts");

const availableOverrides = {
  "2018 Mercedes-Benz AMG GL & GLS-Class": {
    title: "2018 Mercedes-AMG GLS63 4MATIC",
    year: 2018,
    make: "Mercedes-Benz",
    model: "GLS63",
    trim: "AMG 4MATIC",
    bodyType: "SUV",
    drivetrain: "All-wheel drive",
    engine: "5.5-liter twin-turbo V8",
    exteriorColor: "Designo Diamond White Metallic",
    interiorColor: "Black Exclusive Nappa leather"
  },
  "2022 BMW F90 M5": {
    title: "2022 BMW M5 CS",
    year: 2022,
    make: "BMW",
    model: "M5",
    trim: "CS",
    bodyType: "Sedan",
    drivetrain: "All-wheel drive",
    engine: "4.4-liter twin-turbo V8",
    exteriorColor: "Frozen Deep Green Metallic",
    interiorColor: "Black and Mugello Red"
  },
  "2023 GMC Yukon T1XX": {
    title: "2023 GMC Yukon XL Denali",
    year: 2023,
    make: "GMC",
    model: "Yukon XL",
    trim: "Denali",
    bodyType: "SUV",
    drivetrain: "Four-wheel drive",
    engine: "6.2-liter EcoTec V8",
    exteriorColor: "Onyx Black",
    interiorColor: "Jet Black leather"
  }
};

const soldOverrides = {};

const flatSoldImages = [
  {
    file: "photo_2026-05-02_17-53-36.jpg",
    title: "Audi S8 Sedan",
    make: "Audi",
    model: "S8",
    bodyType: "Sedan"
  },
  {
    file: "photo_2026-05-02_17-54-05.jpg",
    title: "Range Rover Velar",
    make: "Land Rover",
    model: "Range Rover Velar",
    bodyType: "SUV"
  },
  {
    file: "photo_2026-05-02_17-54-10.jpg",
    title: "Lexus LS Sedan",
    make: "Lexus",
    model: "LS",
    bodyType: "Sedan"
  },
  {
    file: "photo_2026-05-02_17-54-14.jpg",
    title: "BMW i8 Roadster",
    make: "BMW",
    model: "i8",
    bodyType: "Roadster"
  },
  {
    file: "photo_2026-05-02_17-54-18.jpg",
    title: "BMW M2 Competition",
    make: "BMW",
    model: "M2 Competition",
    bodyType: "Coupe"
  },
  {
    file: "photo_2026-05-02_17-54-22.jpg",
    title: "Mercedes-AMG Sedan",
    make: "Mercedes-Benz",
    model: "AMG Sedan",
    bodyType: "Sedan"
  },
  {
    file: "photo_2026-05-02_17-54-29.jpg",
    title: "Toyota Tundra TRD Pro",
    make: "Toyota",
    model: "Tundra TRD Pro",
    bodyType: "Pickup"
  },
  {
    file: "photo_2026-05-02_17-54-33.jpg",
    title: "Ford Bronco Raptor",
    make: "Ford",
    model: "Bronco Raptor",
    bodyType: "SUV"
  },
  {
    file: "photo_2026-05-02_17-54-37.jpg",
    title: "Chevrolet Camaro ZL1",
    make: "Chevrolet",
    model: "Camaro ZL1",
    bodyType: "Coupe"
  }
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function readPngSize(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      extension: "png"
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
          extension: "jpg"
        };
      }
      offset += 2 + length;
    }
  }
  return { width: 1200, height: 800, extension: extname(filePath).slice(1).toLowerCase() || "jpg" };
}

const OVERVIEW_FILES = new Set(["o.txt", "overview.txt", "t.txt", "text.txt"]);
const SPEC_FILES = new Set(["s.txt", "specs.txt", "spec.txt"]);

function findFileByName(dirPath, candidates) {
  return readdirSync(dirPath).find((entry) => candidates.has(entry.toLowerCase()));
}

function readDescription(dirPath) {
  const file = findFileByName(dirPath, OVERVIEW_FILES);
  if (!file) return "";
  return readFileSync(join(dirPath, file), "utf8").replace(/\s+/g, " ").trim();
}

// Known spec-sheet keys (case-insensitive). When a line normalises to one of these,
// the next non-empty line is treated as the value. This tolerates sheets whose keys
// lack trailing colons and ignores header lines like "Specs" or "Vehicle Details".
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

function normaliseSpecKey(line) {
  return line.replace(/[:：]\s*$/, "").trim().toLowerCase();
}

function parseSpecSheet(dirPath) {
  const file = findFileByName(dirPath, SPEC_FILES);
  if (!file) return null;
  const lines = readFileSync(join(dirPath, file), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const specs = {};
  for (let i = 0; i < lines.length; i++) {
    const key = normaliseSpecKey(lines[i]);
    if (!SPEC_KEYS.has(key)) continue;
    const value = lines[i + 1];
    if (value && !SPEC_KEYS.has(normaliseSpecKey(value))) {
      specs[key] = value;
      i += 1;
    }
  }
  return Object.keys(specs).length > 0 ? specs : null;
}

function parseInteger(value) {
  if (!value) return undefined;
  const cleaned = String(value).replace(/[,\s]/g, "");
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parsePrice(value) {
  if (!value) return undefined;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function specCleanString(value) {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return undefined;
  return trimmed;
}

function buildVehicleFromSpecs(specs, folderName) {
  if (!specs) return null;

  const year = parseInteger(specs.year);
  const make = specCleanString(specs.make) ?? "Vehicle";
  const model = specCleanString(specs.model) ?? folderName;
  const title = year ? `${year} ${make} ${model}` : `${make} ${model}`;

  const vehicle = {
    title,
    year,
    make,
    model,
    bodyType: specCleanString(specs.body),
    engine: specCleanString(specs.engine),
    exteriorColor: specCleanString(specs["exterior color"]),
    interiorColor: specCleanString(specs["interior color"]),
    transmission: specCleanString(specs.transmission),
    fuelType: specCleanString(specs["fuel type"]),
    condition: specCleanString(specs.condition),
    vin: specCleanString(specs.vin),
    stockNumber: specCleanString(specs["stock#"] ?? specs.stock),
    mileage: parseInteger(specs.mileage),
    horsepower: parseInteger(specs.hp),
    cylinders: parseInteger(specs.cylinders)
  };

  const price = parsePrice(specs.price);
  if (price !== undefined) {
    vehicle.price = price;
    vehicle.currency = "USD";
  }

  // Strip undefined keys for tidier JSON output.
  for (const key of Object.keys(vehicle)) {
    if (vehicle[key] === undefined) delete vehicle[key];
  }

  return vehicle;
}

function inferVehicleFromFolder(folderName) {
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

function featureList(vehicle, description) {
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

function seoSummary(description, maxLength = 160) {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= maxLength) return sentence;

  const slice = text.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return slice.slice(0, lastSpace > 80 ? lastSpace : maxLength).trimEnd();
}

function vehicleSummary(vehicle, description) {
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

    const shorterDetails = details.slice(0, 3);
    return `${vehicle.title} with ${shorterDetails.join(", ")}.`;
  }

  return seoSummary(description);
}

function importGroup({ folder, publicSegment, status, overrides, required }) {
  const sourceDir = join(root, folder);
  const publicDir = join(root, "public", publicSegment);

  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(publicDir, { recursive: true });

  if (!existsSync(sourceDir)) {
    if (required) {
      throw new Error(`Missing vehicle source directory: ${sourceDir}`);
    }
    return [];
  }

  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((a, b) => naturalSort(a.name, b.name))
    .map((entry) => {
      const inputDir = join(sourceDir, entry.name);
      // Resolution order:
      // 1. Hard-coded `overrides` map (legacy folders the dealer doesn't have a spec sheet for).
      // 2. Parsed `s.txt` / `Specs.txt` from the folder.
      // 3. Folder-name regex inference as the final fallback.
      const fromSpecs = buildVehicleFromSpecs(parseSpecSheet(inputDir), entry.name);
      const base =
        overrides[entry.name] || fromSpecs || inferVehicleFromFolder(entry.name);
      if (required && !overrides[entry.name] && !fromSpecs) {
        throw new Error(
          `No vehicle metadata override or spec sheet found for ${entry.name}`
        );
      }

      const slug = slugify(base.title);
      const outputDir = join(publicDir, slug);
      mkdirSync(outputDir, { recursive: true });

      const rawDescription = readDescription(inputDir);
      const description =
        rawDescription || `This ${base.title} was previously sold by Carviondealer.`;
      const images = readdirSync(inputDir)
        .filter((file) => /\.(jpe?g|png)$/i.test(file))
        .sort(naturalSort)
        .map((file, index) => {
          const source = join(inputDir, file);
          const size = readPngSize(source);
          const outputName = `${String(index + 1).padStart(2, "0")}.${size.extension}`;
          copyFileSync(source, join(outputDir, outputName));
          return {
            src: `/${publicSegment}/${slug}/${outputName}`,
            alt: `${base.title} photo ${index + 1}`,
            width: size.width,
            height: size.height
          };
        });

      return {
        slug,
        ...base,
        description,
        summary: vehicleSummary(base, description),
        features: featureList(base, description),
        images,
        status
      };
    });
}

function importFlatSoldImages() {
  const sourceDir = join(root, "sold-images");
  const publicDir = join(root, "public", "sold");

  if (!existsSync(sourceDir)) return [];

  return flatSoldImages
    .filter((vehicle) => existsSync(join(sourceDir, vehicle.file)))
    .map((vehicle) => {
      const slug = slugify(vehicle.title);
      const outputDir = join(publicDir, slug);
      const source = join(sourceDir, vehicle.file);
      const size = readPngSize(source);
      const outputName = `01.${size.extension}`;
      const description = `${vehicle.title} is a previously sold Carviondealer vehicle example. Browse current inventory for available vehicle liquidation opportunities.`;

      mkdirSync(outputDir, { recursive: true });
      copyFileSync(source, join(outputDir, outputName));

      return {
        slug,
        ...vehicle,
        file: undefined,
        description,
        summary: description,
        features: [vehicle.make, vehicle.model, vehicle.bodyType].filter(Boolean),
        images: [
          {
            src: `/sold/${slug}/${outputName}`,
            alt: `${vehicle.title} sold vehicle photo`,
            width: size.width,
            height: size.height
          }
        ],
        status: "sold"
      };
    });
}

const vehicles = [
  ...importGroup({
    folder: "3p",
    publicSegment: "inventory",
    status: "available",
    overrides: availableOverrides,
    required: true
  }),
  ...importGroup({
    folder: "sold",
    publicSegment: "sold",
    status: "sold",
    overrides: soldOverrides,
    required: false
  }),
  ...importFlatSoldImages()
];

const generated = `import type { Vehicle } from "@/src/lib/vehicles";

export const vehicles: Vehicle[] = ${JSON.stringify(vehicles, null, 2)};
`;

writeFileSync(outputFile, generated);

console.log(`Imported ${vehicles.length} vehicles`);
for (const vehicle of vehicles) {
  console.log(`- ${vehicle.title} (${vehicle.status}): ${vehicle.images.length} images`);
}
