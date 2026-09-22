"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { site } from "@/src/lib/site";
import { trackEvent } from "@/src/lib/analytics";
import { InquireButton } from "@/src/components/InquireButton";
import { vehicleImageSrc } from "@/src/lib/imageVersion";
import {
  buildVehiclePath,
  formatHorsepower,
  formatMileage,
  formatPrice,
  type Vehicle,
  type VehicleImage
} from "@/src/lib/vehicles";

type Props = {
  vehicles: Vehicle[];
};

export function InventoryGrid({ vehicles }: Props) {
  const handleCall = useCallback((vehicle: Vehicle) => {
    if (site.phone) {
      trackEvent("phone_click", {
        source: "inventory_card",
        vehicle_slug: vehicle.slug,
        vehicle_title: vehicle.title
      });
      window.location.href = `tel:${site.phone.replace(/[^+\d]/g, "")}`;
    }
  }, []);

  return (
    <div className="vehicle-grid">
        {vehicles.map((vehicle, index) => {
          const cover = vehicle.images[0];
          return (
            <article className="vehicle-card" key={vehicle.slug}>
              <Link
                className="vehicle-card-media"
                href={buildVehiclePath(vehicle)}
                aria-label={`Open ${vehicle.title} listing`}
              >
                {cover ? (
                  <Image
                    src={vehicleImageSrc(cover.src)}
                    alt={cover.alt}
                    width={cover.width}
                    height={cover.height}
                    sizes="(min-width: 1100px) 380px, (min-width: 720px) 50vw, 100vw"
                    priority={index < 3}
                    style={{ objectPosition: imageObjectPosition(cover) }}
                  />
                ) : null}
                {vehicle.bodyType ? (
                  <span className="vehicle-card-badge">{vehicle.bodyType}</span>
                ) : null}
              </Link>
              <div className="vehicle-card-body">
                <p className="vehicle-card-meta">
                  {[vehicle.year, vehicle.make].filter(Boolean).join(" · ")}
                </p>
                <h3 className="vehicle-card-title">
                  <Link href={buildVehiclePath(vehicle)}>{vehicle.title}</Link>
                </h3>
                {(() => {
                  const parts = [
                    formatMileage(vehicle),
                    formatHorsepower(vehicle),
                    vehicle.transmission || vehicle.drivetrain || vehicle.engine
                  ].filter((part): part is string => Boolean(part));
                  return parts.length > 0 ? (
                    <p className="vehicle-card-trim">{parts.join(" · ")}</p>
                  ) : null;
                })()}
                {(() => {
                  const price = formatPrice(vehicle);
                  return price ? <p className="vehicle-card-price">{price}</p> : null;
                })()}
                <div className="vehicle-card-actions">
                  <div className="vehicle-card-cta-row">
                    <InquireButton vehicle={vehicle} className="btn btn-block">
                      Contact us
                    </InquireButton>
                    {site.phone ? (
                      <button
                        type="button"
                        className="vehicle-card-call vehicle-card-call-text"
                        onClick={() => handleCall(vehicle)}
                        aria-label={`Call us about the ${vehicle.title}`}
                        title={`Call ${site.phoneDisplay || site.phone}`}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span>Call us</span>
                      </button>
                    ) : null}
                  </div>
                  <Link className="vehicle-card-view" href={buildVehiclePath(vehicle)}>
                    View details
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
  );
}

function imageObjectPosition(image: VehicleImage) {
  return `${image.focusX ?? 50}% ${image.focusY ?? 50}%`;
}
