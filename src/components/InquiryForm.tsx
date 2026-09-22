"use client";

import { useState, type FormEvent } from "react";
import { trackEvent } from "@/src/lib/analytics";
import { trackLeadSubmission } from "@/src/lib/metaPixel";
import { submitLead } from "@/src/lib/leads";
import { isTurnstileEnabled, TurnstileWidget } from "@/src/components/TurnstileWidget";
import { isValidUsPhone, US_PHONE_HINT } from "@/src/lib/phone";
import { isValidEmail, EMAIL_HINT } from "@/src/lib/validation";
import type { Vehicle } from "@/src/lib/vehicles";

type Props = {
  vehicle?: Vehicle;
  price?: string | null;
  title?: string;
  compact?: boolean;
  id?: string;
};

export function InquiryForm({
  vehicle,
  price,
  title = "Vehicle inquiry",
  compact = false,
  id = "vehicle-inquiry"
}: Props) {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  // Tracked so the submit button can reflect validity as the visitor types.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Both channels are now required, so hints only appear once a field has been
  // typed in — an untouched form should not look like a wall of errors.
  const phoneFilled = phone.trim().length > 0;
  const emailFilled = email.trim().length > 0;
  const phoneOk = isValidUsPhone(phone);
  const emailOk = isValidEmail(email);
  const canSubmit =
    name.trim().length > 0 &&
    phoneOk &&
    emailOk &&
    (!isTurnstileEnabled() || Boolean(turnstileToken));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") ?? "").trim();
    const trap = String(data.get("company") ?? "").trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (trap) return;
    // The button is disabled while invalid, but these checks stay: Enter still
    // submits, and a disabled attribute is trivially removed in devtools.
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!isValidUsPhone(trimmedPhone)) {
      setError(US_PHONE_HINT);
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError(EMAIL_HINT);
      return;
    }
    if (isTurnstileEnabled() && !turnstileToken) {
      setError("Please complete the verification.");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      await submitLead({
        source: "vehicle_inquiry",
        topic: vehicle ? "vehicle" : "general",
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        message,
        price: price ?? undefined,
        link: typeof window !== "undefined" ? window.location.href : undefined,
        vehicleTitle: vehicle?.title,
        vehicleSlug: vehicle?.slug,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        turnstileToken
      });
      trackEvent("vehicle_inquiry_submitted", {
        source: vehicle ? "vehicle_detail" : "contact",
        vehicle_slug: vehicle?.slug
      });
      // Reached only after the API confirmed the lead — never on a failed send.
      // Advanced Matching, then Lead and Purchase with the vehicle's price.
      trackLeadSubmission({
        user: { email: trimmedEmail, phone: trimmedPhone, name: trimmedName },
        content_category: vehicle ? "vehicle_inquiry" : "general_inquiry",
        slug: vehicle?.slug,
        title: vehicle?.title,
        price: vehicle?.price,
        currency: vehicle?.currency
      });
      setStatus("sent");
      form.reset();
      // Controlled inputs are not cleared by form.reset().
      setName("");
      setPhone("");
      setEmail("");
      setTurnstileToken("");
      setTurnstileResetKey((key) => key + 1);
    } catch {
      setError("Could not send the inquiry. Please call or try again.");
      setStatus("idle");
      setTurnstileToken("");
      setTurnstileResetKey((key) => key + 1);
    }
  }

  return (
    <form
      id={id}
      className={compact ? "inquiry-form compact" : "inquiry-form"}
      onSubmit={onSubmit}
      noValidate
    >
      <div className="inquiry-form-head">
        <p className="eyebrow">Inquiry</p>
        <h2>{title}</h2>
      </div>

      <div className="inquiry-trap">
        <label htmlFor="inquiry-company">Company</label>
        <input id="inquiry-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="inquiry-field">
        <label htmlFor="inquiry-name">Name</label>
        <input
          id="inquiry-name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="inquiry-grid">
        <div className="inquiry-field">
          <label htmlFor="inquiry-phone">Phone</label>
          <input
            id="inquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(206) 555-0123"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={phoneFilled && !phoneOk}
          />
          {phoneFilled && !phoneOk ? (
            <p className="inquiry-field-hint">{US_PHONE_HINT}</p>
          ) : null}
        </div>
        <div className="inquiry-field">
          <label htmlFor="inquiry-email">Email</label>
          <input
            id="inquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailFilled && !emailOk}
          />
          {emailFilled && !emailOk ? (
            <p className="inquiry-field-hint">{EMAIL_HINT}</p>
          ) : null}
        </div>
      </div>

      <div className="inquiry-field">
        <label htmlFor="inquiry-message">Message</label>
        <textarea
          id="inquiry-message"
          name="message"
          rows={compact ? 3 : 5}
          defaultValue={vehicle ? `I'm interested in the ${vehicle.title}.` : ""}
        />
      </div>

      <TurnstileWidget
        resetKey={turnstileResetKey}
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken("")}
        onError={() => setTurnstileToken("")}
      />

      {error ? (
        <p className="inquiry-error" role="alert">
          {error}
        </p>
      ) : null}
      {status === "sent" ? (
        <p className="inquiry-success" role="status">
          Inquiry sent.
        </p>
      ) : null}

      <button
        className="btn btn-block"
        type="submit"
        disabled={status === "submitting" || !canSubmit}
      >
        {status === "submitting" ? "Sending..." : "Submit inquiry"}
      </button>
      {!canSubmit && status !== "submitting" ? (
        <p className="inquiry-field-hint">
          Fill in your name, phone number and email to send.
        </p>
      ) : null}
    </form>
  );
}
