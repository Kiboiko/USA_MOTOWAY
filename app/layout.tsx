import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { InquireButton } from "@/src/components/InquireButton";
import { MetaPixel } from "@/src/components/MetaPixel";
import { LiveChat } from "@/src/components/LiveChat";
import { PostHogProvider } from "@/src/components/PostHogProvider";
import { META_PIXEL_ID } from "@/src/lib/metaPixel";
import { navItems, site } from "@/src/lib/site";
import { JsonLd, organizationSchema, websiteSchema } from "@/src/lib/schema";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap"
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Late-Model Luxury & Performance Vehicles`,
    template: `%s | ${site.name}`
  },
  description: site.description,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} | Late-Model Luxury & Performance Vehicles`,
    description: site.description
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | Late-Model Luxury & Performance Vehicles`,
    description: site.description
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <PostHogProvider>
          <JsonLd data={organizationSchema()} />
          <JsonLd data={websiteSchema()} />
          <div className="topbar">
            <div className="topbar-inner">
              <span>{site.hours}</span>
              <span className="topbar-contact">
                {site.phone ? (
                  <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}>
                    {site.phoneDisplay || site.phone}
                  </a>
                ) : null}
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </span>
            </div>
          </div>
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="brand" aria-label={`${site.name} home`}>
                <Image
                  src="/brand/logo.png"
                  alt={site.name}
                  width={822}
                  height={256}
                  priority
                  unoptimized
                />
              </Link>
              <nav className="nav" aria-label="Primary navigation">
                {navItems.slice(1).map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main>
            {children}
          </main>
          <footer className="footer">
            <div className="footer-inner">
              <div className="footer-brand">
                <Image
                  src="/brand/logo.png"
                  alt={site.name}
                  width={822}
                  height={256}
                  unoptimized
                />
                <p>{site.description}</p>
              </div>
              <div>
                <h3>Browse</h3>
                {navItems.map((item) => (
                  <p key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </p>
                ))}
              </div>
              <div>
                <h3>Reach us</h3>
                {site.phone ? (
                  <p>
                    <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}>
                      {site.phoneDisplay || site.phone}
                    </a>
                  </p>
                ) : null}
                <p>
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
                <p>{site.hours}</p>
                <p className="footer-address">
                  {site.address.street}
                  <br />
                  {site.address.city}, {site.address.region} {site.address.postalCode}
                </p>
                <div className="footer-cta">
                  <InquireButton className="btn">Contact us</InquireButton>
                </div>
              </div>
            </div>
            <div className="footer-base">
              <span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span>
              <span>Late-model luxury & performance vehicles</span>
            </div>
          </footer>
          <MetaPixel />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
          <LiveChat />
        </PostHogProvider>
      </body>
    </html>
  );
}
