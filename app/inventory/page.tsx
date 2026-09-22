import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { getManagedAvailableVehicles } from "@/src/lib/server/inventoryStore";
import { InventoryGrid } from "@/src/components/InventoryGrid";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";

export const metadata: Metadata = {
  title: "Available Inventory",
  description:
    "Browse current Carviondealer inventory — late-model luxury and performance vehicles with full photos, configuration details, and direct contact.",
  alternates: {
    canonical: "/inventory"
  }
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const vehicles = await getManagedAvailableVehicles();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Inventory", url: `${site.url}/inventory` }
        ])}
      />
      <section className="paper section">
        <div className="shell">
          <div className="roster-head">
            <div>
              <p className="eyebrow">Available inventory</p>
              <h1 className="display h1">Cars currently for sale.</h1>
              <p className="lede">
                Tap any car for the full photo set and configuration, then send us a note or call
                now to ask about price, history, and viewing.
              </p>
            </div>
            <div className="actions">
              <InquireButton className="btn ghost">Contact us</InquireButton>
              <CallNowButton className="btn ghost" source="inventory_roster" />
            </div>
          </div>

          <div style={{ marginTop: "clamp(40px, 5vw, 64px)" }}>
            <InventoryGrid vehicles={vehicles} />
          </div>
        </div>
      </section>

      <section className="contact-band">
        <div className="shell">
          <p className="eyebrow">Don't see what you're looking for?</p>
          <h2 className="display">
            Tell us what you want.
            <br />
            We'll find it.
          </h2>
          <p className="contact-lede">
            We source vehicles for buyers regularly. Send us the make, model, year range, and
            preferences — we'll let you know when something matches.
          </p>
          <div className="row">
            <a className="email" href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <p className="small">{site.hours}</p>
          </div>
        </div>
      </section>
    </>
  );
}
