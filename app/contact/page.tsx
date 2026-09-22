import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/src/lib/schema";
import { site } from "@/src/lib/site";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";
import { InquiryForm } from "@/src/components/InquiryForm";

export const metadata: Metadata = {
  title: "Contact Carviondealer in Kent, WA",
  description:
    "Contact Carviondealer in Kent, Washington by email about a specific vehicle, request more photos, or ask about pricing and delivery.",
  alternates: {
    canonical: "/contact"
  }
};

// The dealership has a verified Google Business listing, so the embed is
// pinned to that place by its id: Google then draws its own card with the
// business name, category and hours, exactly as it does in Maps.
const mapEmbedSrc = `https://www.google.com/maps?cid=${site.address.googlePlaceCid}&output=embed`;
const mapLinkHref = `https://maps.google.com/?cid=${site.address.googlePlaceCid}`;

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: site.url },
          { name: "Contact", url: `${site.url}/contact` }
        ])}
      />

      <section className="dark section">
        <div className="shell page-shell">
          <p className="eyebrow">Contact us</p>
          <h1 className="display h1">Let's talk about your next car.</h1>
          <p className="lede">
            Ask about a specific vehicle, request more photos or video, check pricing, or tell us
            what you're after — we'll get back to you with a real reply.
          </p>
        </div>
      </section>

      <section className="paper section tight">
        <div className="shell">
          <div className="contact-grid">
            <div className="contact-info">
              <p className="eyebrow">Reach the desk</p>
              <h2 className="display h2">A real reply, every time.</h2>

              <dl className="contact-list">
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${site.email}`}>{site.email}</a>
                  </dd>
                </div>
                {site.phone ? (
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}>
                        {site.phoneDisplay || site.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Hours</dt>
                  <dd>{site.hours}</dd>
                </div>
                <div>
                  <dt>Visit by appointment</dt>
                  <dd>
                    {site.address.street}
                    <br />
                    {site.address.city}, {site.address.region} {site.address.postalCode}
                  </dd>
                </div>
              </dl>

              <p className="contact-note">
                Email is the fastest way to reach us — send a note and we'll come back with
                pricing, extra photos, and next steps.
              </p>

              <div className="actions" style={{ marginTop: 24 }}>
                <InquireButton className="btn dark">Contact us</InquireButton>
                <CallNowButton className="btn ghost" source="contact" />
                <a className="btn ghost" href="#contact-inquiry">
                  Enquiry
                </a>
              </div>
            </div>

            <div className="contact-stack">
              <InquiryForm id="contact-inquiry" title="Send an inquiry" />
              <div className="contact-map">
                <iframe
                  src={mapEmbedSrc}
                  title={`Map showing ${site.name} at ${site.address.full}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <a
                  className="map-link"
                  href={mapLinkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-band">
        <div className="shell">
          <p className="eyebrow">Email us</p>
          <h2 className="display">
            We reply personally
            <br />
            to every message.
          </h2>
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
