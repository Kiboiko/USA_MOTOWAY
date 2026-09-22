import { vehicles as rawVehicles } from "@/src/data/vehicles.generated";

export type VehicleStatus = "available" | "sold";

export type VehicleImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  focusX?: number;
  focusY?: number;
};

export type Vehicle = {
  slug: string;
  title: string;
  year?: number;
  make: string;
  model: string;
  trim?: string;
  bodyType?: string;
  drivetrain?: string;
  engine?: string;
  exteriorColor?: string;
  interiorColor?: string;
  description: string;
  summary: string;
  features: string[];
  images: VehicleImage[];
  status: VehicleStatus;
  price?: number;
  currency?: string;
  // Extended specs sourced from the dealer's `s.txt` / `Specs.txt` sheet.
  vin?: string;
  stockNumber?: string;
  mileage?: number;
  horsepower?: number;
  cylinders?: number;
  transmission?: string;
  fuelType?: string;
  condition?: string;
};

export function formatMileage(vehicle: Vehicle): string | null {
  if (vehicle.mileage === undefined) return null;
  return new Intl.NumberFormat("en-US").format(vehicle.mileage) + " mi";
}

export function formatHorsepower(vehicle: Vehicle): string | null {
  if (vehicle.horsepower === undefined) return null;
  return new Intl.NumberFormat("en-US").format(vehicle.horsepower) + " hp";
}

// Price overlay — kept here (not in the auto-generated data file) so the
// import:vehicles script can be re-run without clobbering pricing. Empty since
// the current batch carries its own pricing in the spec sheets; the GLS63 is
// deliberately listed without a price.
const PRICE_BY_SLUG: Record<string, number> = {};

const vehicles: Vehicle[] = rawVehicles.map((vehicle) => {
  const price = PRICE_BY_SLUG[vehicle.slug];
  return price !== undefined ? { ...vehicle, price, currency: "USD" } : vehicle;
});

export function getVehicles(): Vehicle[] {
  return vehicles;
}

export function formatPrice(vehicle: Vehicle): string | null {
  if (vehicle.price === undefined) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: vehicle.currency ?? "USD",
    maximumFractionDigits: 0
  }).format(vehicle.price);
}

const DEMOTED_SLUGS = new Set<string>(["2018-mercedes-amg-gls63-4matic"]);

export function getAvailableVehicles(): Vehicle[] {
  const available = vehicles.filter((vehicle) => vehicle.status === "available");
  const promoted = available.filter((v) => !DEMOTED_SLUGS.has(v.slug));
  const demoted = available.filter((v) => DEMOTED_SLUGS.has(v.slug));
  return [...promoted, ...demoted];
}

export function getSoldVehicles(): Vehicle[] {
  return vehicles.filter((vehicle) => vehicle.status === "sold");
}

export function getVehicle(slug: string): Vehicle | undefined {
  return vehicles.find((vehicle) => vehicle.slug === slug);
}

export function buildVehiclePath(vehicle: Vehicle): string {
  return vehicle.status === "sold" ? `/sold/${vehicle.slug}` : `/inventory/${vehicle.slug}`;
}

export function buildVehicleUrl(slug: string, status: VehicleStatus = "available"): string {
  return status === "sold" ? `/sold/${slug}` : `/inventory/${slug}`;
}

export function shortSummary(vehicle: Vehicle, maxLength = 180): string {
  const source = (vehicle.description || vehicle.summary || "").trim();
  if (!source) return "";
  // Prefer the first sentence if it's reasonable.
  const firstSentence = source.match(/^.+?[.!?](?=\s|$)/);
  if (firstSentence && firstSentence[0].length <= maxLength + 40) {
    return firstSentence[0];
  }
  if (source.length <= maxLength) return source;
  const slice = source.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 80 ? lastSpace : maxLength).trimEnd()}…`;
}
