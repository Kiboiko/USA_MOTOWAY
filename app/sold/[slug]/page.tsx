import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbSchema, vehicleSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import {
  getManagedSoldVehicles,
  getManagedVehicle
} from "@/src/lib/server/inventoryStore";
import { VehicleGallery } from "@/src/components/VehicleGallery";
import { CallNowButton } from "@/src/components/CallNowButton";
import { InquireButton } from "@/src/components/InquireButton";
import { InquiryForm } from "@/src/components/InquiryForm";

type SoldVehiclePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return (await getManagedSoldVehicles()).map((vehicle) => ({
    slug: vehicle.slug
  }));
}

export async function generateMetadata({ params }: SoldVehiclePageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getManagedVehicle(slug);

  if (!vehicle || vehicle.status !== "sold") {
    return {
      title: "Sold Vehicle Not Found"
    };
  }

  const image = vehicle.images[0];

  return {
    title: `${vehicle.title} — sold`,
    description: vehicle.summary,
    alternates: {
      canonical: `/sold/${vehicle.slug}`
    },
    openGraph: {
      type: "article",
      url: `${site.url}/sold/${vehicle.slug}`,
      title: `${vehicle.title} Sold | Carviondealer`,
      description: vehicle.summary,
      images: image
        ? [
            {
              url: image.src,
              width: image.width,
              height: image.height,
              alt: image.alt
            }
          ]
        : undefined
    }
  };
}

export default async function SoldVehiclePage({ params }: SoldVehiclePageProps) {
  const { slug } = await params;
  const vehicle = await getManagedVehicle(slug);

  if (!vehicle || vehicle.status !== "sold") {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Sold", url: `${site.url}/sold` },
          { name: vehicle.title, url: `${site.url}/sold/${vehicle.slug}` }
        ])}
      />
      <JsonLd data={vehicleSchema(vehicle)} />

      <section className="dark section">
        <div className="shell">
          <div className="detail-hero">
            <div>
              <p className="eyebrow">
                <Link href="/sold" style={{ textDecoration: "none" }}>
                  Recently sold
                </Link>
                {" · "}
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              </p>
              <h1 className="display h1">{vehicle.title}</h1>
            </div>
            <div className="detail-meta">
              <span className="badge">
                <span className="dot" aria-hidden="true" />
                Sold
              </span>
              <p>{vehicle.images.length} photos · {vehicle.bodyType ?? "Vehicle"}</p>
            </div>
          </div>

          <div className="detail-layout">
            <VehicleGallery images={vehicle.images} title={vehicle.title} />

            <aside className="detail-panel">
              <div className="group">
                <h2>Configuration</h2>
                <dl className="spec-list">
                  {vehicle.year ? (
                    <div>
                      <dt>Year</dt>
                      <dd>{vehicle.year}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Make</dt>
                    <dd>{vehicle.make}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{vehicle.model}</dd>
                  </div>
                  {vehicle.trim ? (
                    <div>
                      <dt>Trim</dt>
                      <dd>{vehicle.trim}</dd>
                    </div>
                  ) : null}
                  {vehicle.bodyType ? (
                    <div>
                      <dt>Body</dt>
                      <dd>{vehicle.bodyType}</dd>
                    </div>
                  ) : null}
                  {vehicle.engine ? (
                    <div>
                      <dt>Engine</dt>
                      <dd>{vehicle.engine}</dd>
                    </div>
                  ) : null}
                  {vehicle.drivetrain ? (
                    <div>
                      <dt>Drivetrain</dt>
                      <dd>{vehicle.drivetrain}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="group">
                <div className="detail-cta-row">
                  <InquireButton vehicle={vehicle} className="btn btn-block">
                    Contact us
                  </InquireButton>
                  <CallNowButton className="btn ghost btn-block" source="sold_detail">
                    Call us
                  </CallNowButton>
                  <a className="btn ghost btn-block" href="#vehicle-inquiry">
                    Enquiry
                  </a>
                </div>
                <p className="panel-note">
                  Looking for a similar vehicle? Send us a note and we'll tell you what
                  may be coming in.
                </p>
                <Link className="text-link" href="/inventory" style={{ marginTop: 16 }}>
                  See current inventory
                </Link>
              </div>

              <InquiryForm id="vehicle-inquiry" vehicle={vehicle} title="Find a similar car" compact />
            </aside>
          </div>

          <div className="detail-overview">
            <h2>About this vehicle</h2>
            <p>{vehicle.description}</p>
          </div>

        </div>
      </section>
    </>
  );
}
