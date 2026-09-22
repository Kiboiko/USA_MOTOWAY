import type { MetadataRoute } from "next";
import { site } from "@/src/lib/site";
import { buildVehiclePath } from "@/src/lib/vehicles";
import { getManagedVehicles } from "@/src/lib/server/inventoryStore";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date("2026-05-07T00:00:00.000Z");
  const staticPages = ["", "/inventory", "/sold", "/why-liquidation", "/how-it-works", "/about", "/contact"];
  const vehiclePages = (await getManagedVehicles()).map((vehicle) => buildVehiclePath(vehicle));

  return [...staticPages, ...vehiclePages].map((path) => ({
    url: `${site.url}${path}`,
    lastModified,
    changeFrequency: path.startsWith("/inventory") ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/inventory/") ? 0.8 : 0.7
  }));
}
