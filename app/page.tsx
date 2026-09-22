import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd, faqSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import {
  buildVehiclePath,
  type VehicleImage
} from "@/src/lib/vehicles";
import {
  getManagedAvailableVehicles,
  getManagedSoldVehicles
} from "@/src/lib/server/inventoryStore";
import { InventoryGrid } from "@/src/components/InventoryGrid";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";
import { InquiryForm } from "@/src/components/InquiryForm";
import { vehicleImageSrc } from "@/src/lib/imageVersion";

export const metadata: Metadata = {
  alternates: {
    canonical: "/"
  }
};

const faqs = [
  {
    question: "What kind of vehicles does Carviondealer sell?",
    answer:
      "Late-model luxury and performance vehicles — premium SUVs, performance sedans, and high-end coupes from brands like Mercedes-AMG, BMW M, GMC Denali, and Range Rover."
  },
  {
    question: "Can I get a pre-purchase inspection?",
    answer:
      "Yes. We welcome a third-party pre-purchase inspection at any qualified shop of your choosing, at your cost. We'll coordinate access to the vehicle."
  },
  {
    question: "Do you offer delivery?",
    answer:
      "Yes — nationwide delivery is available through trusted enclosed and open transport partners. We'll quote shipping for your zip code on request."
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Bank wire transfer or certified bank check are the standard options. We can walk you through the steps once you've decided on a vehicle."
  },
  {
    question: "Do you take trade-ins?",
    answer:
      "Yes, we consider clean trade-ins on a case-by-case basis. Send photos, mileage, and any history of your current vehicle and we'll come back with a number."
  },
  {
    question: "How do I see a vehicle in person or get more information?",
    answer:
      "Send us a note about the specific vehicle and we'll reply by email with pricing, additional photos or a walkaround video on request, history information, and next steps for viewing or delivery."
  }
];

const reasons = [
  {
    idx: "01",
    title: "Cars worth driving",
    body: "We focus on late-model luxury and performance — premium SUVs, M cars, AMGs, Denalis. Every vehicle is one we'd be happy to own."
  },
  {
    idx: "02",
    title: "Real photos. Real specs.",
    body: "Every listing shows the actual car, photographed in detail, with the real configuration. No stock images, no surprises on delivery day."
  },
  {
    idx: "03",
    title: "Talk to a real person",
    body: "When you reach out, you get an answer from us — not a call center, not a finance pitch. Ask any question about the car and you'll get a straight answer."
  }
];

const services = [
  {
    title: "Hand-picked selection",
    body: "Every vehicle on the floor is personally vetted before it goes up. We only list cars we'd be happy to drive ourselves."
  },
  {
    title: "Honest listings",
    body: "Real photos of the actual vehicle, the real configuration, and a written description. What you see is what you get."
  },
  {
    title: "Personal service",
    body: "When you reach out, you talk to us — not a call center, not a sales floor, not a finance pitch. Real answers, fast."
  },
  {
    title: "Buy with confidence",
    body: "Take your time. Ask any question. Look at the car from every angle. We're here to help you make the right call."
  }
];

const HOME_VEHICLE_LIMIT = 6;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allVehicles = await getManagedAvailableVehicles();
  const featuredVehicles = allVehicles.slice(0, HOME_VEHICLE_LIMIT);
  const totalAvailable = allVehicles.length;
  const remaining = Math.max(0, totalAvailable - featuredVehicles.length);
  const soldVehicles = await getManagedSoldVehicles();
  const soldPreview = soldVehicles.slice(0, 6);

  return (
    <>
      <JsonLd data={faqSchema(faqs)} />

      {/* ───── Hero ───── */}
      <section className="hero">
        <div className="hero-media">
          <Image
            src="/brand/hero-carviondealer.jpg"
            alt="Showroom with late-model luxury and performance vehicles"
            width={1280}
            height={720}
            priority
          />
        </div>
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-inner">
          <h1 className="display h1">
            Premium cars,
            <br />
            <em>direct from us</em> to you.
          </h1>
          <p className="hero-lede">
            Carviondealer sources clean, late-model luxury and performance vehicles and offers them
            without the dealership runaround. Real photos, honest details, and a straight answer
            when you reach out.
          </p>
          <div className="actions">
            <Link className="btn" href="/inventory">
              View available cars
            </Link>
            <InquireButton className="btn ghost">Contact us</InquireButton>
            <CallNowButton className="btn ghost" source="home_hero" />
          </div>
        </div>
      </section>

      {/* ───── Available now ───── */}
      <section className="paper section">
        <div className="shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Available now</p>
              <h2 className="display h2">A look at what's in stock.</h2>
              <p className="lede">
                A small selection of what's currently available. Click any car for the full photo set,
                configuration, and a direct way to ask us anything about it.
              </p>
            </div>
            <Link className="text-link" href="/inventory">
              See all inventory
            </Link>
          </div>

          <InventoryGrid vehicles={featuredVehicles} />

          {remaining > 0 ? (
            <div className="inventory-overflow-cta">
              <Link className="btn dark" href="/inventory">
                Browse all available cars
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* ───── Why buy from us ───── */}
      <section className="dark section tight">
        <div className="shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Why buyers choose us</p>
              <h2 className="display h2">A simpler, more honest way to buy.</h2>
            </div>
          </div>
          <div className="principles">
            {reasons.map((item) => (
              <div key={item.idx}>
                <span className="idx">{item.idx}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── What we provide ───── */}
      <section className="paper section tight">
        <div className="shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">What we provide</p>
              <h2 className="display h2">Everything you need to buy with confidence.</h2>
              <p className="lede">
                Buying a car at this level is a serious decision. We make it easy to do your
                homework before you commit.
              </p>
            </div>
          </div>
          <div className="services-grid">
            {services.map((service) => (
              <div className="service-card" key={service.title}>
                <h3>{service.title}</h3>
                <p>{service.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Recently sold ───── */}
      {soldPreview.length > 0 ? (
        <section className="paper section tight">
          <div className="shell">
            <div className="section-head">
              <div>
                <p className="eyebrow">Recently sold</p>
                <h2 className="display h2">Cars that have already found owners.</h2>
                <p className="lede">
                  A look at the kind of vehicles we move. If you're after something similar, let us
                  know — we may have one coming in.
                </p>
              </div>
              <Link className="text-link" href="/sold">
                View sold gallery
              </Link>
            </div>
            <div className="sold-strip">
              {soldPreview.map((vehicle) => (
                <Link className="sold-card" href={buildVehiclePath(vehicle)} key={vehicle.slug}>
                  <div className="frame">
                    {vehicle.images[0] ? (
                      <Image
                        src={vehicleImageSrc(vehicle.images[0].src)}
                        alt={vehicle.images[0].alt}
                        width={vehicle.images[0].width}
                        height={vehicle.images[0].height}
                        sizes="(min-width: 1100px) 200px, (min-width: 600px) 33vw, 50vw"
                        style={{ objectPosition: imageObjectPosition(vehicle.images[0]) }}
                      />
                    ) : null}
                  </div>
                  <span className="label">{vehicle.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ───── We also buy / acquisitions ───── */}
      <section className="dark section tight">
        <div className="shell">
          <div className="acquire">
            <div className="acquire-copy">
              <p className="eyebrow">Selling or trading?</p>
              <h2 className="display h2">We're always looking for clean cars.</h2>
              <p className="lede">
                If you own a clean, late-model luxury or performance vehicle and you're thinking
                about selling — or you'd like to trade up — we'd like to hear about it. Send a few
                photos, the mileage, and any history you have. We'll come back with a real number,
                no obligation.
              </p>
              <div className="actions">
                <InquireButton className="btn">Contact us</InquireButton>
                <CallNowButton className="btn ghost" source="home_acquire" />
              </div>
              <InquiryForm id="home-acquire-inquiry" title="Send an inquiry" compact />
            </div>
            <ul className="acquire-list">
              <li>
                <span>What we buy</span>
                <p>Late-model premium SUVs, AMG and BMW M models, performance sedans and coupes, and select luxury vehicles.</p>
              </li>
              <li>
                <span>What to send</span>
                <p>Year, make, model, trim, mileage, exterior &amp; interior photos, and any service or accident history.</p>
              </li>
              <li>
                <span>What you get back</span>
                <p>A real offer based on the actual vehicle — usually within 24 to 48 hours of receiving your details.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="paper section tight">
        <div className="shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Common questions</p>
              <h2 className="display h2">What buyers usually want to know.</h2>
              <p className="lede">
                If your question isn't here, send it over. We answer every email personally.
              </p>
            </div>
            <InquireButton className="text-link inquire-textlink">Contact us</InquireButton>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details className="faq-item" key={faq.question}>
                <summary>
                  <span>{faq.question}</span>
                  <span className="faq-toggle" aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Contact ───── */}
      <section className="contact-band">
        <div className="shell">
          <p className="eyebrow">Got a question?</p>
          <h2 className="display">
            Talk to us about
            <br />
            your next vehicle.
          </h2>
          <p className="contact-lede">
            Ask about a specific car, request more photos, check availability, or tell us what
            you're looking for. We'll get back to you with a straight answer.
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
