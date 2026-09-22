import type { Metadata } from "next";
import Link from "next/link";
import { InquireButton } from "@/src/components/InquireButton";
import { CallNowButton } from "@/src/components/CallNowButton";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <section className="dark section">
      <div className="shell page-shell">
        <p className="eyebrow">404</p>
        <h1 className="display h1">We couldn't find that page.</h1>
        <p className="lede">
          The page you're looking for may have moved or been removed. Take a look at what's
          currently available, or get in touch.
        </p>
        <div className="actions">
          <Link className="btn" href="/inventory">
            View available cars
          </Link>
          <InquireButton className="btn ghost">Contact us</InquireButton>
          <CallNowButton className="btn ghost" source="not_found" />
          <Link className="btn ghost" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
