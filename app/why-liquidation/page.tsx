import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";

export const metadata: Metadata = {
  title: "Why buy from us",
  description:
    "Why buyers choose Carviondealer for late-model luxury and performance vehicles — better pricing, honest details, and a direct buying experience.",
  alternates: {
    canonical: "/why-liquidation"
  }
};

const notes = [
  {
    num: "01",
    title: "Better pricing on great cars",
    body: "Because we source through wholesale and liquidation channels, we can offer late-model luxury and performance vehicles at prices traditional dealerships rarely match."
  },
  {
    num: "02",
    title: "What you see is what you get",
    body: "Real photos of the actual vehicle, the real configuration, and a clear written description. If anything matters to you, ask — we'll tell you what we know."
  },
  {
    num: "03",
    title: "No pressure, no upsells",
    body: "Send us a note, get a real reply, take your time. We don't run finance pitches or aggressive callback campaigns. You move forward when the car is right."
  }
];

export default function WhyLiquidationPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Why Liquidation", url: `${site.url}/why-liquidation` }
        ])}
      />
      <section className="dark section">
        <div className="shell page-shell">
          <p className="eyebrow">Why buy from us</p>
          <h1 className="display h1">Premium cars, without the dealership runaround.</h1>
          <p className="lede">
            Buying a luxury or performance car shouldn't mean haggling with a sales floor or
            wading through generic listings. Here's why our buyers choose us.
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
          <div className="actions">
            <Link className="btn" href="/inventory">
              View available cars
            </Link>
            <InquireButton className="btn ghost">Contact us</InquireButton>
            <CallNowButton className="btn ghost" source="why_liquidation" />
            <Link className="btn ghost" href="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
