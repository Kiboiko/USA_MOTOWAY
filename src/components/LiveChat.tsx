"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { trackEvent } from "@/src/lib/analytics";
import { trackLeadSubmission } from "@/src/lib/metaPixel";
import { submitLead } from "@/src/lib/leads";
import { isTurnstileEnabled, TurnstileWidget } from "@/src/components/TurnstileWidget";
import { isValidUsPhone, US_PHONE_HINT } from "@/src/lib/phone";
import { isValidEmail, EMAIL_HINT } from "@/src/lib/validation";
import { site } from "@/src/lib/site";

// Contact widget: the visitor picks a topic and leaves their details in one
// form. There is deliberately no two-way messaging — the submission goes to
// /api/leads (Google Sheets + email) and the team replies by email.

type Topic = "vehicle" | "about" | "sell";

const TOPICS: Record<Topic, { label: string; bot: string; placeholder: string }> = {
  vehicle: {
    label: "I'm interested in a car",
    bot: "Awesome — leave your name and the best way to reach you, plus a quick note about which vehicle. We'll get back to you.",
    placeholder: "Which vehicle are you interested in?"
  },
  about: {
    label: "Tell me about Carviondealer",
    bot: "Happy to help. Drop your details and what you'd like to know — we'll get back to you.",
    placeholder: "What would you like to know?"
  },
  sell: {
    label: "I want to sell or trade",
    bot: "Got it. Leave your details and a quick note about your car (year, make, model, mileage). We'll come back with a real number.",
    placeholder: "Year, make, model, mileage…"
  }
};

export function LiveChat() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [errorMsg, setErrorMsg] = useState("");
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

  // The "Contact us" buttons around the site open this panel.
  useEffect(() => {
    const openFromCta = () => {
      setOpen(true);
      trackEvent("chat_opened", { source: "page_cta" });
    };
    window.addEventListener("carviondealer:open-live-chat", openFromCta);
    return () => window.removeEventListener("carviondealer:open-live-chat", openFromCta);
  }, []);

  const pickTopic = useCallback((next: Topic) => {
    setTopic(next);
    setErrorMsg("");
    trackEvent("chat_topic_selected", { topic: next });
  }, []);

  const reset = useCallback(() => {
    setTopic(null);
    setStatus("idle");
    setErrorMsg("");
    setTurnstileToken("");
    setTurnstileResetKey((key) => key + 1);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") ?? "").trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (String(data.get("company") ?? "").trim()) return; // honeypot
    // The button is disabled while invalid, but these checks stay: Enter still
    // submits, and a disabled attribute is trivially removed in devtools.
    if (!trimmedName) {
      setErrorMsg("Name is required.");
      return;
    }
    if (!isValidUsPhone(trimmedPhone)) {
      setErrorMsg(US_PHONE_HINT);
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setErrorMsg(EMAIL_HINT);
      return;
    }
    if (isTurnstileEnabled() && !turnstileToken) {
      setErrorMsg("Please complete the verification.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      await submitLead({
        source: "support_chat",
        topic,
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        message,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        link: typeof window !== "undefined" ? window.location.href : undefined,
        turnstileToken
      });
      // Reached only after the API confirmed the lead — never on a failed send.
      // Advanced Matching, then Lead and Purchase (no vehicle, so no price).
      trackLeadSubmission({
        user: { email: trimmedEmail, phone: trimmedPhone, name: trimmedName },
        content_category: "support_chat"
      });
      trackEvent("chat_lead_submitted", { topic });
      setStatus("sent");
      form.reset();
      // Controlled inputs are not cleared by form.reset().
      setName("");
      setPhone("");
      setEmail("");
    } catch {
      setErrorMsg("Could not send your request. Please call or try again.");
      setStatus("idle");
    } finally {
      setTurnstileToken("");
      setTurnstileResetKey((key) => key + 1);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`chat-launcher${open ? " is-open" : ""}`}
        onClick={() =>
          setOpen((v) => {
            if (!v) trackEvent("chat_opened", { source: "launcher" });
            return !v;
          })
        }
        aria-label={open ? "Close contact form" : "Open contact form"}
        aria-expanded={open}
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>

      <div
        className={`chat-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="Carviondealer contact form"
        aria-hidden={!open}
      >
        <header className="chat-head">
          <div className="chat-head-info">
            <div className="chat-head-avatar" aria-hidden="true">
              <span>C</span>
            </div>
            <div className="chat-head-titles">
              <p className="chat-head-name">Carviondealer Support</p>
              <p className="chat-head-status">
                <span className="chat-status-dot" /> Usually replies in a few minutes
              </p>
            </div>
          </div>
          <button
            type="button"
            className="chat-close"
            onClick={() => setOpen(false)}
            aria-label="Close contact form"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {status === "sent" ? (
          <div className="chat-recovery">
            <button type="button" onClick={reset}>
              Send another request
            </button>
          </div>
        ) : null}

        <div className="chat-body">
          <div className="chat-row chat-row-bot">
            <div className="chat-avatar" aria-hidden="true">
              C
            </div>
            <div className="chat-bubble chat-bubble-bot">Hi there. How can we help you today?</div>
          </div>

          {!topic ? (
            <div className="chat-quick-replies" role="group" aria-label="Choose a topic">
              {(Object.keys(TOPICS) as Topic[]).map((t) => (
                <button type="button" key={t} className="chat-chip" onClick={() => pickTopic(t)}>
                  {TOPICS[t].label}
                </button>
              ))}
            </div>
          ) : null}

          {topic ? (
            <>
              <div className="chat-row chat-row-user">
                <div className="chat-bubble chat-bubble-user">{TOPICS[topic].label}</div>
              </div>
              <div className="chat-row chat-row-bot">
                <div className="chat-avatar" aria-hidden="true">
                  C
                </div>
                <div className="chat-bubble chat-bubble-bot">
                  {status === "sent"
                    ? "Thanks — we've got your details. A Carviondealer specialist will reply by email shortly."
                    : TOPICS[topic].bot}
                </div>
              </div>
            </>
          ) : null}

          {topic && status !== "sent" ? (
            <div className="chat-row chat-row-bot">
              <div className="chat-avatar" aria-hidden="true">
                C
              </div>
              <form className="chat-form-card" onSubmit={onSubmit} noValidate>
                <div className="chat-field">
                  <label htmlFor="lc-name">Your name</label>
                  <input
                    id="lc-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="chat-field-grid">
                  <div className="chat-field">
                    <label htmlFor="lc-phone">Phone</label>
                    <input
                      id="lc-phone"
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
                  <div className="chat-field">
                    <label htmlFor="lc-email">Email</label>
                    <input
                      id="lc-email"
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
                <div className="chat-field">
                  <label htmlFor="lc-message">Message</label>
                  <textarea
                    id="lc-message"
                    name="message"
                    rows={3}
                    placeholder={TOPICS[topic].placeholder}
                  />
                </div>
                <div className="chat-trap" aria-hidden="true">
                  <label htmlFor="lc-company">Company</label>
                  <input id="lc-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <TurnstileWidget
                  resetKey={turnstileResetKey}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  onError={() => setTurnstileToken("")}
                />

                {errorMsg ? (
                  <p className="chat-form-error" role="alert">
                    {errorMsg}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="chat-form-submit"
                  disabled={status === "submitting" || !canSubmit}
                >
                  {status === "submitting" ? "Sending…" : "Send request"}
                </button>
                {!canSubmit && status !== "submitting" ? (
                  <p className="inquiry-field-hint">
                    Add your name, phone number and email to send.
                  </p>
                ) : null}
              </form>
            </div>
          ) : null}
        </div>

        <footer className="chat-foot">
          <span>Or email</span>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </footer>
      </div>
    </>
  );
}
