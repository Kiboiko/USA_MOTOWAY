import { site } from "@/src/lib/site";
import type { Vehicle } from "@/src/lib/vehicles";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${site.url}/#business`,
    name: site.name,
    legalName: site.name,
    url: site.url,
    logo: `${site.url}/brand/logo.png`,
    image: `${site.url}/brand/hero-carviondealer.jpg`,
    email: site.email,
    ...(site.phone ? { telephone: site.phone } : {}),
    openingHours: "Mo-Fr 09:00-17:00",
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.countryCode
    },
    // Coordinates and map link come from the verified Google Business listing,
    // which is what ties this page to that listing in local search.
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.address.lat,
      longitude: site.address.lng
    },
    hasMap: `https://maps.google.com/?cid=${site.address.googlePlaceCid}`,
    areaServed: {
      "@type": "Country",
      name: site.country
    },
    priceRange: "$$",
    currenciesAccepted: "USD",
    paymentAccepted: "Bank wire transfer, certified bank check",
    contactPoint: {
      "@type": "ContactPoint",
      email: site.email,
      ...(site.phone ? { telephone: site.phone } : {}),
      contactType: "sales",
      areaServed: site.countryCode,
      availableLanguage: "English"
    },
    sameAs: []
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function vehicleSchema(vehicle: Vehicle) {
  const path = vehicle.status === "sold" ? `/sold/${vehicle.slug}` : `/inventory/${vehicle.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: vehicle.title,
    url: `${site.url}${path}`,
    image: vehicle.images.map((image) => `${site.url}${image.src}`),
    description: vehicle.description,
    brand: {
      "@type": "Brand",
      name: vehicle.make
    },
    model: vehicle.model,
    vehicleModelDate: vehicle.year ? String(vehicle.year) : undefined,
    bodyType: vehicle.bodyType,
    driveWheelConfiguration: vehicle.drivetrain,
    vehicleEngine: vehicle.engine,
    color: vehicle.exteriorColor,
    vehicleInteriorColor: vehicle.interiorColor,
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
    vehicleIdentificationNumber: vehicle.vin,
    sku: vehicle.stockNumber,
    itemCondition:
      vehicle.condition?.toLowerCase().includes("new") &&
      !vehicle.condition?.toLowerCase().includes("like new")
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
    ...(vehicle.mileage !== undefined
      ? {
          mileageFromOdometer: {
            "@type": "QuantitativeValue",
            value: vehicle.mileage,
            unitCode: "SMI"
          }
        }
      : {}),
    offers: {
      "@type": "Offer",
      availability:
        vehicle.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: `${site.url}${path}`,
      ...(vehicle.price !== undefined
        ? {
            price: vehicle.price,
            priceCurrency: vehicle.currency ?? "USD"
          }
        : {})
    }
  };
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
