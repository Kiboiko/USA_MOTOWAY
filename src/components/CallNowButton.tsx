"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/src/lib/analytics";
import { site } from "@/src/lib/site";

type Props = {
  className?: string;
  children?: ReactNode;
  source?: string;
};

export function CallNowButton({ className = "btn", children = "Call us", source = "page_cta" }: Props) {
  if (!site.phone) return null;

  return (
    <a
      className={className}
      href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}
      onClick={() => {
        trackEvent("phone_click", { source });
      }}
    >
      {children}
    </a>
  );
}
