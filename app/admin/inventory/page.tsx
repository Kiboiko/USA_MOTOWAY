import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminInventory } from "./AdminInventory";

const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || "";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory manager",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminInventoryPage() {
  const host = (await headers()).get("host") ?? "";

  if (host === "carviondealer.com" || host === "www.carviondealer.com") {
    if (ADMIN_ALIAS) {
      redirect(`${ADMIN_ALIAS}/admin/inventory`);
    }
  }

  return <AdminInventory />;
}
