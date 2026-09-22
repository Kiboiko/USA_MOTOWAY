import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";

export const metadata: Metadata = {
  title: "About",
  description:
    "Carviondealer sources late-model luxury and performance vehicles for buyers who want clean cars, honest information, and a direct buying experience.",
  alternates: {
    canonical: "/about"
  }
};

const notes = [
  {
    num: "01",
    title: "Cars we'd be happy to drive",
    body: "We focus on late-model luxury and performance — premium SUVs, AMGs, BMW M cars, Denalis, Range Rovers, and similar. Anything we wouldn't be happy to own, we pass on."
  },
  {
    num: "02",
    title: "Honest, detailed listings",
    body: "Every car gets a full photo set of the actual vehicle, the real configuration, and a clear written description. Ask us for additional photos, video, or history and we'll send what we have."
  },
  {
    num: "03",
    title: "Direct buying, end to end",
    body: "From your first email to keys in hand, you work with us — not a sales floor. Inspection welcome, history shared on request, payment by wire or bank check, delivery anywhere in the country."
  }
];

const services = [
  {
    title: "Buying",
    body: "Browse what's available now, ask anything by email, and we'll handle pricing, history, inspection access, and delivery from there."
  },
  {
    title: "Sourcing",
    body: "Looking for a specific car? Tell us the make, model, year, and what matters to you — we'll let you know when something matches."
  },
  {
    title: "Acquiring",
    body: "Have a clean, late-model vehicle you're ready to sell or trade? Send photos and details and we'll come back with a real offer."
  }
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "About", url: `${site.url}/about` }
        ])}
      />
      <section className="dark section">
        <div className="shell page-shell">
          <p className="eyebrow">About Carviondealer</p>
          <h1 className="display h1">A simpler way to buy a great car.</h1>
          <p className="lede">
            We source clean, late-model luxury and performance vehicles and offer them directly to
            buyers — without the dealership runaround. Real photos, honest information, and a
            straight answer when you reach out.
          </p>
          <div className="note-stack">
            {notes.map((note) => (
              <article key={note.num}>
                <span className="num">{note.num}</span>
                <div>
                  <h2>{note.title}</h2>
                  <p>{note.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="paper section tight">
        <div className="shell page-shell">
          <p className="eyebrow">What we do</p>
          <h2 className="display h2">Three sides of the same business.</h2>
          <p className="lede">
            We buy, source, and sell late-model luxury and performance cars. Whichever side you're
            on, you're talking to the same people.
          </p>
          <div className="services-grid" style={{ marginTop: "clamp(32px, 4vw, 48px)" }}>
            {services.map((service) => (
              <div className="service-card" key={service.title}>
                <h3>{service.title}</h3>
                <p>{service.body}</p>
              </div>
            ))}
          </div>
          <div className="actions">
            <Link className="btn dark" href="/inventory">
              View available cars
            </Link>
            <InquireButton className="btn ghost">Contact us</InquireButton>
            <CallNowButton className="btn ghost" source="about" />
          </div>
        </div>
      </section>
    </>
  );
}
