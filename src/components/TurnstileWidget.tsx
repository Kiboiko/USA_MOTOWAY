"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (errorCode?: string) => void;
  resetKey?: string | number;
};

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (errorCode?: string) => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      appearance?: "always" | "execute" | "interaction-only";
      retry?: "auto" | "never";
      "retry-interval"?: number;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true";
const SITE_KEY = TURNSTILE_ENABLED
  ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim().replace(/^['"]|['"]$/g, "")
  : "";

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  resetKey
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerIdRef = useRef(`turnstile-${Math.random().toString(36).slice(2)}`);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onError, onExpire, onVerify]);

  useEffect(() => {
    let cancelled = false;
    if (!SITE_KEY || !scriptReady || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    try {
      widgetIdRef.current = window.turnstile.render(`#${containerIdRef.current}`, {
        sitekey: SITE_KEY,
        theme: "auto",
        size: "normal",
        appearance: "always",
        retry: "auto",
        "retry-interval": 8000,
        callback: (token) => onVerifyRef.current(token),
        "expired-callback": () => {
          onExpireRef.current?.();
        },
        "error-callback": (errorCode) => {
          onErrorRef.current?.(errorCode);
        }
      });
    } catch {
      onErrorRef.current?.();
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [resetKey, scriptReady]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        id="carviondealer-turnstile"
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => onErrorRef.current?.()}
      />
      <div id={containerIdRef.current} className="turnstile-widget" ref={containerRef} />
    </>
  );
}

export function isTurnstileEnabled() {
  return TURNSTILE_ENABLED && Boolean(SITE_KEY);
}
