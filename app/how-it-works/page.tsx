import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";

export const metadata: Metadata = {
  title: "How buying works",
  description:
    "How buying a car from Carviondealer works — from first email through inspection, payment, and delivery to your door.",
  alternates: {
    canonical: "/how-it-works"
  }
};

const faqs = [
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
  }
];

const steps = [
  {
    num: "01",
    title: "Browse and pick a vehicle",
    body: "Open any listing for the full photo set, configuration details, and what we know about the car. The same listing has a direct email link to start a conversation."
  },
  {
    num: "02",
    title: "Get the details you need",
    body: "We'll reply with pricing, additional photos, a walkaround video on request, the vehicle history report, and any service records we have on file."
  },
  {
    num: "03",
    title: "Inspect or test drive",
    body: "Come see the car in person, or arrange a third-party pre-purchase inspection at any qualified shop of your choosing. We'll coordinate access."
  },
  {
    num: "04",
    title: "Agree on the deal",
    body: "Talk through pricing, trade-in (if any), and delivery. Once we're aligned, we'll send the purchase paperwork for review."
  },
  {
    num: "05",
    title: "Pay and take delivery",
    body: "Pay by bank wire or certified check. Pick the car up, or we'll arrange enclosed or open transport to your door anywhere in the country."
  }
];

const practical = [
  {
    label: "Inspection",
    body: "Any qualified third-party shop you trust — we welcome the inspection and coordinate access."
  },
  {
    label: "Vehicle history",
    body: "Carfax or AutoCheck report shared on request. Service records and ownership info when available."
  },
  {
    label: "Payment",
    body: "Bank wire transfer or certified bank check. We don't take credit cards or cash for full purchases."
  },
  {
    label: "Delivery",
    body: "Nationwide via vetted enclosed or open transport partners. Pickup in person also welcome."
  },
  {
    label: "Trade-ins",
    body: "Considered case by case. Send photos, mileage, and history and we'll come back with a real number."
  },
  {
    label: "Response time",
    body: "Most questions get a personal reply within 24 hours on weekdays."
  }
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "How It Works", url: `${site.url}/how-it-works` }
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <section className="dark section">
        <div className="shell page-shell">
          <p className="eyebrow">How buying works</p>
          <h1 className="display h1">A clear path from first email to your driveway.</h1>
          <p className="lede">
            Buying a luxury or performance car shouldn't be confusing. Here's exactly how the
            process works with us — and the answers to the questions buyers ask most.
          </p>
          <div className="note-stack">
            {steps.map((step) => (
              <article key={step.num}>
                <span className="num">{step.num}</span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="paper section tight">
        <div className="shell page-shell">
          <p className="eyebrow">Practical details</p>
          <h2 className="display h2">The answers buyers want up front.</h2>
          <p className="lede">
            We'd rather give you the practical details now than make you ask for them later.
          </p>
          <dl className="practical-grid">
            {practical.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
          <div className="actions">
            <Link className="btn dark" href="/inventory">
              View available cars
            </Link>
            <InquireButton className="btn ghost">Contact us</InquireButton>
            <CallNowButton className="btn ghost" source="how_it_works" />
          </div>
        </div>
      </section>
    </>
  );
}
