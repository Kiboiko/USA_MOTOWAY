import { NextResponse } from "next/server";
import { getManagedVehicle } from "@/src/lib/server/inventoryStore";

type VehicleRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: VehicleRouteContext) {
  const { slug } = await context.params;
  const vehicle = await getManagedVehicle(slug);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({
    vehicle
  });
}
