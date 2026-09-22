import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd, breadcrumbSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { buildVehiclePath, type VehicleImage } from "@/src/lib/vehicles";
import { getManagedSoldVehicles } from "@/src/lib/server/inventoryStore";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";
import { vehicleImageSrc } from "@/src/lib/imageVersion";

export const metadata: Metadata = {
  title: "Recently sold",
  description:
    "Recently sold vehicles by Carviondealer — examples of the kind of late-model luxury and performance cars we move.",
  alternates: {
    canonical: "/sold"
  }
};

export const dynamic = "force-dynamic";

export default async function SoldPage() {
  const vehicles = await getManagedSoldVehicles();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Sold", url: `${site.url}/sold` }
        ])}
      />
      <section className="dark section">
        <div className="shell">
          <div className="roster-head">
            <div>
              <p className="eyebrow">Recently sold</p>
              <h1 className="display h1">Cars we've sold.</h1>
              <p className="lede">
                A look at the kind of vehicles we move. If you're looking for something similar, let
                us know — we may have one coming in soon.
              </p>
            </div>
            <div className="roster-actions">
              <InquireButton className="btn">Contact us</InquireButton>
              <CallNowButton className="btn ghost" source="sold_roster" />
              <Link className="btn ghost" href="/inventory">
                See current inventory
              </Link>
            </div>
          </div>

          {vehicles.length > 0 ? (
            <div className="sold-gallery" style={{ marginTop: "clamp(48px, 6vw, 80px)" }}>
              {vehicles.map((vehicle) => (
                <Link className="sold-card" href={buildVehiclePath(vehicle)} key={vehicle.slug}>
                  <div className="frame">
                    {vehicle.images[0] ? (
                      <Image
                        src={vehicleImageSrc(vehicle.images[0].src)}
                        alt={vehicle.images[0].alt}
                        width={vehicle.images[0].width}
                        height={vehicle.images[0].height}
                        sizes="(min-width: 980px) 33vw, (min-width: 600px) 50vw, 100vw"
                        style={{ objectPosition: imageObjectPosition(vehicle.images[0]) }}
                      />
                    ) : null}
                  </div>
                  <span className="label">{vehicle.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: "48px" }}>
              <h2>Sold gallery coming soon</h2>
              <p>Check back shortly, or take a look at what's currently available.</p>
              <div className="actions" style={{ justifyContent: "center" }}>
                <Link className="btn" href="/inventory">
                  See current inventory
                </Link>
                <InquireButton className="btn ghost">Contact us</InquireButton>
                <CallNowButton className="btn ghost" source="sold_empty" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="contact-band">
        <div className="shell">
          <p className="eyebrow">Looking for something specific?</p>
          <h2 className="display">
            Tell us what you want.
            <br />
            We'll find it.
          </h2>
          <p className="contact-lede">
            We source vehicles for buyers regularly. Send us the make, model, year, and what
            matters to you — we'll let you know when something matches.
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

function imageObjectPosition(image: VehicleImage) {
  return `${image.focusX ?? 50}% ${image.focusY ?? 50}%`;
}
