"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/src/lib/analytics";
import type { Vehicle } from "@/src/lib/vehicles";

type Props = {
  vehicle?: Vehicle;
  className?: string;
  children?: ReactNode;
};

export function InquireButton({ vehicle, className = "btn btn-block", children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        trackEvent("live_chat_cta_clicked", {
          source: vehicle ? "vehicle" : "general",
          vehicle_slug: vehicle?.slug,
          vehicle_title: vehicle?.title
        });
        window.dispatchEvent(new Event("carviondealer:open-live-chat"));
      }}
    >
      {children ?? "Contact us"}
    </button>
  );
}
