import { NextResponse } from "next/server";
import {
  getManagedAvailableVehicles,
  getManagedSoldVehicles,
  getManagedVehicles
} from "@/src/lib/server/inventoryStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const vehicles =
    status === "available"
      ? await getManagedAvailableVehicles()
      : status === "sold"
        ? await getManagedSoldVehicles()
        : await getManagedVehicles();

  return NextResponse.json({
    vehicles
  });
}
