"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { vehicleImageSrc } from "@/src/lib/imageVersion";
import type { VehicleImage } from "@/src/lib/vehicles";

type Props = {
  images: VehicleImage[];
  title: string;
};

export function VehicleGallery({ images, title }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);
  const prev = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, next, prev]);

  const active = openIndex === null ? null : images[openIndex];

  return (
    <>
      <div className="gallery" aria-label={`${title} photo gallery`}>
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            className={`frame ${index === 0 ? "full" : "half"}`}
            onClick={() => setOpenIndex(index)}
            aria-label={`Open photo ${index + 1} of ${images.length}`}
          >
            <Image
              src={vehicleImageSrc(image.src)}
              alt={image.alt}
              width={image.width}
              height={image.height}
              priority={index === 0}
              sizes={index === 0 ? "(min-width: 1024px) 64vw, 100vw" : "(min-width: 1024px) 32vw, 50vw"}
              style={{ objectPosition: imageObjectPosition(image) }}
            />
            <span className="frame-zoom" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {active ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — photo ${openIndex! + 1} of ${images.length}`}
          onClick={close}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={close}
            aria-label="Close gallery"
          >
            ×
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="lightbox-nav prev"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                className="lightbox-nav next"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          ) : null}

          <figure className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
            <Image
              src={vehicleImageSrc(active.src)}
              alt={active.alt}
              width={active.width}
              height={active.height}
              sizes="100vw"
              priority
            />
            <figcaption>
              {openIndex! + 1} / {images.length} · {title}
            </figcaption>
          </figure>

          <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
            {images.map((thumb, i) => (
              <button
                key={thumb.src}
                type="button"
                className={`lightbox-thumb${i === openIndex ? " is-active" : ""}`}
                onClick={() => setOpenIndex(i)}
                aria-label={`Show photo ${i + 1}`}
              >
                <Image
                  src={vehicleImageSrc(thumb.src)}
                  alt=""
                  width={thumb.width}
                  height={thumb.height}
                  sizes="80px"
                  style={{ objectPosition: imageObjectPosition(thumb) }}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function imageObjectPosition(image: VehicleImage) {
  return `${image.focusX ?? 50}% ${image.focusY ?? 50}%`;
}
