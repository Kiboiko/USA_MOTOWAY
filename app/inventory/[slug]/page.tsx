import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbSchema, vehicleSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import {
  formatHorsepower,
  formatMileage,
  formatPrice
} from "@/src/lib/vehicles";
import {
  getManagedAvailableVehicles,
  getManagedVehicle
} from "@/src/lib/server/inventoryStore";
import { VehicleGallery } from "@/src/components/VehicleGallery";
import { CallNowButton } from "@/src/components/CallNowButton";
import { InquireButton } from "@/src/components/InquireButton";
import { InquiryForm } from "@/src/components/InquiryForm";
import { CarViewContent } from "@/src/components/CarViewContent";

type VehiclePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return (await getManagedAvailableVehicles()).map((vehicle) => ({
    slug: vehicle.slug
  }));
}

export async function generateMetadata({ params }: VehiclePageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getManagedVehicle(slug);

  if (!vehicle || vehicle.status !== "available") {
    return {
      title: "Vehicle Not Found"
    };
  }

  const image = vehicle.images[0];

  return {
    title: vehicle.title,
    description: vehicle.summary,
    alternates: {
      canonical: `/inventory/${vehicle.slug}`
    },
    openGraph: {
      type: "article",
      url: `${site.url}/inventory/${vehicle.slug}`,
      title: `${vehicle.title} | Carviondealer`,
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

export default async function VehiclePage({ params }: VehiclePageProps) {
  const { slug } = await params;
  const vehicle = await getManagedVehicle(slug);

  if (!vehicle || vehicle.status !== "available") {
    notFound();
  }

  const displayPrice = formatPrice(vehicle);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Inventory", url: `${site.url}/inventory` },
          { name: vehicle.title, url: `${site.url}/inventory/${vehicle.slug}` }
        ])}
      />
      <JsonLd data={vehicleSchema(vehicle)} />
      <CarViewContent
        slug={vehicle.slug}
        title={vehicle.title}
        price={vehicle.price}
        currency={vehicle.currency}
      />

      <section className="dark section">
        <div className="shell">
          <div className="detail-hero">
            <div>
              <p className="eyebrow">
                <Link href="/inventory" style={{ textDecoration: "none" }}>
                  Inventory
                </Link>
                {" · "}
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              </p>
              <h1 className="display h1">{vehicle.title}</h1>
            </div>
            <div className="detail-meta">
              <span className="badge">
                <span className="dot" aria-hidden="true" />
                Available
              </span>
              {displayPrice ? <p className="detail-price">{displayPrice}</p> : null}
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
                  {vehicle.horsepower !== undefined ? (
                    <div>
                      <dt>Horsepower</dt>
                      <dd>{formatHorsepower(vehicle)}</dd>
                    </div>
                  ) : null}
                  {vehicle.cylinders !== undefined ? (
                    <div>
                      <dt>Cylinders</dt>
                      <dd>{vehicle.cylinders}</dd>
                    </div>
                  ) : null}
                  {vehicle.transmission ? (
                    <div>
                      <dt>Transmission</dt>
                      <dd>{vehicle.transmission}</dd>
                    </div>
                  ) : null}
                  {vehicle.drivetrain ? (
                    <div>
                      <dt>Drivetrain</dt>
                      <dd>{vehicle.drivetrain}</dd>
                    </div>
                  ) : null}
                  {vehicle.fuelType ? (
                    <div>
                      <dt>Fuel</dt>
                      <dd>{vehicle.fuelType}</dd>
                    </div>
                  ) : null}
                  {vehicle.mileage !== undefined ? (
                    <div>
                      <dt>Mileage</dt>
                      <dd>{formatMileage(vehicle)}</dd>
                    </div>
                  ) : null}
                  {vehicle.condition ? (
                    <div>
                      <dt>Condition</dt>
                      <dd>{vehicle.condition}</dd>
                    </div>
                  ) : null}
                  {vehicle.exteriorColor ? (
                    <div>
                      <dt>Exterior</dt>
                      <dd>{vehicle.exteriorColor}</dd>
                    </div>
                  ) : null}
                  {vehicle.interiorColor ? (
                    <div>
                      <dt>Interior</dt>
                      <dd>{vehicle.interiorColor}</dd>
                    </div>
                  ) : null}
                  {vehicle.vin ? (
                    <div>
                      <dt>VIN</dt>
                      <dd className="vin-value">{vehicle.vin}</dd>
                    </div>
                  ) : null}
                  {vehicle.stockNumber ? (
                    <div>
                      <dt>Stock #</dt>
                      <dd>{vehicle.stockNumber}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {vehicle.features.length > 0 ? (
                <div className="group">
                  <h2>Highlights</h2>
                  <ul className="feature-list">
                    {vehicle.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="group">
                <h2>What we'll send you</h2>
                <ul className="feature-list">
                  <li>Pricing and payment options</li>
                  <li>Additional photos or a walkaround video</li>
                  <li>Vehicle history report (Carfax / AutoCheck)</li>
                  <li>Service records and ownership info we have on file</li>
                  <li>Delivery quote for your zip code</li>
                </ul>
              </div>

              <div className="group">
                <div className="detail-cta-row">
                  <InquireButton vehicle={vehicle} className="btn btn-block">
                    Contact us
                  </InquireButton>
                  <CallNowButton
                    className="btn ghost btn-block"
                    source="vehicle_detail"
                  >
                    Call us
                  </CallNowButton>
                  <a className="btn ghost btn-block" href="#vehicle-inquiry">
                    Enquiry
                  </a>
                </div>
                <p className="panel-note">
                  Ask about availability, pricing, history, viewing, or delivery. Pre-purchase
                  inspections welcome.
                </p>
              </div>

              <InquiryForm id="vehicle-inquiry" vehicle={vehicle} price={displayPrice} compact />
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
