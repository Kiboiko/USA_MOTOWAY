"use client";

import { useEffect } from "react";
import { trackCarViewContent } from "@/src/lib/metaPixel";

type Props = {
  slug: string;
  title: string;
  price?: number;
  currency?: string;
};

/** Reports a Meta ViewContent for the vehicle page it is rendered on. */
export function CarViewContent({ slug, title, price, currency }: Props) {
  // Keyed on the vehicle, so re-renders never report a second view; the
  // cleanup also cancels a pending send when React re-runs the effect.
  useEffect(
    () => trackCarViewContent({ slug, title, price, currency }),
    [slug, title, price, currency]
  );

  return null;
}
