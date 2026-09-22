"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CLIENT_STATUS_LABELS,
  normalizeVehicleUrl,
  vehicleSlugFromUrl,
  type ClientRecord,
  type ClientStatus
} from "@/src/lib/clients";
import { site } from "@/src/lib/site";
import type { Vehicle } from "@/src/lib/vehicles";

type ClientsResponse = {
  ok?: boolean;
  clients?: ClientRecord[];
  metaConfigured?: boolean;
  metaTestMode?: boolean;
  error?: string;
};

type ClientResponse = { ok?: boolean; client?: ClientRecord; alreadySent?: boolean; error?: string };

type Filter = "all" | ClientStatus;

type Draft = {
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zip: string;
  vehicleSlug: string;
  vehicleTitle: string;
  vehicleUrl: string;
  price: string;
  notes: string;
};

const PASSCODE_KEY = "carviondealer.liveChat.adminPasscode";
const PASSCODE_COOKIE = "carviondealer_live_chat_admin";
const ADMIN_API_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || "";

const EMPTY_DRAFT: Draft = {
  name: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  zip: "",
  vehicleSlug: "",
  vehicleTitle: "",
  vehicleUrl: "",
  price: "",
  notes: ""
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: CLIENT_STATUS_LABELS.open },
  { id: "purchased", label: CLIENT_STATUS_LABELS.purchased },
  { id: "lost", label: CLIENT_STATUS_LABELS.lost }
];

export function AdminClients() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(true);
  const [metaTestMode, setMetaTestMode] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCustomDomain(window.location.hostname) && ADMIN_API_ORIGIN) {
      window.location.replace(
        `${ADMIN_API_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      return;
    }

    const stored = window.sessionStorage.getItem(PASSCODE_KEY);
    if (stored) {
      setPasscode(stored);
      setPasscodeCookie(stored);
    }
  }, []);

  const authHeaders = useMemo(() => buildAuthHeaders(passcode), [passcode]);
  const active = clients.find((client) => client.id === activeId);
  const dirty = active ? !sameDraft(draft, toDraft(active)) : !sameDraft(draft, EMPTY_DRAFT);

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(PASSCODE_KEY);
    clearPasscodeCookie();
    setPasscode(null);
    setClients([]);
    setActiveId("");
    setDraft(EMPTY_DRAFT);
  }, []);

  const loadClients = useCallback(async () => {
    if (!passcode) return;
    setLoading(true);
    try {
      const res = await fetch(adminApiUrl("/api/admin/clients"), { cache: "no-store", headers: authHeaders });
      if (res.status === 401) {
        signOut();
        setAuthError("The saved manager passcode was rejected.");
        return;
      }
      const json = (await res.json()) as ClientsResponse;
      if (!res.ok || !json.ok) {
        setNotice({ tone: "error", text: json.error || "Clients could not be loaded." });
        return;
      }
      setClients(json.clients ?? []);
      setMetaConfigured(Boolean(json.metaConfigured));
      setMetaTestMode(Boolean(json.metaTestMode));
    } catch {
      setNotice({ tone: "error", text: "Network error while loading clients." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, passcode, signOut]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  // The inventory feeds the vehicle picker; the page still works without it.
  useEffect(() => {
    if (!passcode) return;
    fetch(adminApiUrl("/api/admin/inventory"), { cache: "no-store", headers: authHeaders })
      .then((res) => (res.ok ? (res.json() as Promise<{ vehicles?: Vehicle[] }>) : null))
      .then((json) => setVehicles(json?.vehicles ?? []))
      .catch(() => undefined);
  }, [authHeaders, passcode]);

  const onPasscodeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = passInput.trim();
      if (!trimmed) {
        setAuthError("Please enter the manager passcode.");
        return;
      }

      setAuthError("");
      const res = await fetch(adminApiUrl("/api/admin/clients"), {
        cache: "no-store",
        headers: buildAuthHeaders(trimmed)
      });
      if (res.status === 401) {
        setAuthError("That passcode didn't work. Try again.");
        return;
      }
      if (!res.ok) {
        setAuthError("The clients backend is not reachable right now.");
        return;
      }

      window.sessionStorage.setItem(PASSCODE_KEY, trimmed);
      setPasscodeCookie(trimmed);
      setPasscode(trimmed);
      setPassInput("");
    },
    [passInput]
  );

  const confirmDiscard = useCallback(() => !dirty || window.confirm("Discard unsaved changes?"), [dirty]);

  const selectClient = useCallback(
    (client: ClientRecord) => {
      if (client.id === activeId || !confirmDiscard()) return;
      setActiveId(client.id);
      setDraft(toDraft(client));
      setNotice(null);
    },
    [activeId, confirmDiscard]
  );

  const startNew = useCallback(() => {
    if (!confirmDiscard()) return;
    setActiveId("");
    setDraft(EMPTY_DRAFT);
    setNotice(null);
  }, [confirmDiscard]);

  const updateDraft = useCallback((key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const pickVehicle = useCallback(
    (slug: string) => {
      const vehicle = vehicles.find((item) => item.slug === slug);
      setDraft((current) => {
        // A link that pointed at the previously picked listing follows the pick; a link typed by hand stays.
        const linkFollowsPick = !current.vehicleUrl || vehicleSlugFromUrl(current.vehicleUrl) !== "";
        return {
          ...current,
          vehicleSlug: slug,
          vehicleTitle: vehicle ? vehicle.title : current.vehicleTitle,
          vehicleUrl: linkFollowsPick ? (vehicle ? listingUrl(vehicle) : "") : current.vehicleUrl,
          price: vehicle?.price && !current.price ? String(vehicle.price) : current.price
        };
      });
    },
    [vehicles]
  );

  const changeVehicleUrl = useCallback(
    (value: string) => setDraft((current) => withVehicleUrl(current, value, vehicles)),
    [vehicles]
  );

  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);

  const applyPaste = useCallback(() => {
    const parsed = parseClientDetails(pasteText);
    if (!Object.keys(parsed).length) {
      setNotice({ tone: "error", text: "Nothing recognised — put name, phone, email, price and link on separate lines." });
      return;
    }
    setDraft((current) => {
      const { vehicleUrl, ...fields } = parsed;
      const next = { ...current, ...fields };
      return vehicleUrl ? withVehicleUrl(next, vehicleUrl, vehicles, true) : next;
    });
    setPasteText("");
    setPasteOpen(false);
    setNotice({ tone: "ok", text: "Form filled from the pasted details — check it and press Save." });
  }, [pasteText, vehicles]);

  const applyClient = useCallback((client: ClientRecord) => {
    setClients((current) => {
      const exists = current.some((item) => item.id === client.id);
      return exists ? current.map((item) => (item.id === client.id ? client : item)) : [client, ...current];
    });
    setActiveId(client.id);
    setDraft(toDraft(client));
  }, []);

  /** Saves the form; returns the stored record, or null if saving failed. */
  const persist = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      if (!passcode) return null;
      const res = await fetch(
        adminApiUrl(activeId ? `/api/admin/clients/${encodeURIComponent(activeId)}` : "/api/admin/clients"),
        {
          method: activeId ? "PATCH" : "POST",
          headers: { ...authHeaders, "content-type": "application/json" },
          body: JSON.stringify({ ...draft, price: draft.price, ...extra })
        }
      );
      const json = (await res.json()) as ClientResponse;
      if (!res.ok || !json.ok || !json.client) {
        setNotice({ tone: "error", text: json.error || "Client could not be saved." });
        return null;
      }
      applyClient(json.client);
      return json.client;
    },
    [activeId, applyClient, authHeaders, draft, passcode]
  );

  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
    } catch {
      setNotice({ tone: "error", text: "Network error. Nothing was lost — try again." });
    } finally {
      setBusy(false);
    }
  }, []);

  const save = useCallback(
    () =>
      run(async () => {
        if (await persist()) setNotice({ tone: "ok", text: "Saved." });
      }),
    [persist, run]
  );

  const setStatus = useCallback(
    (status: ClientStatus) =>
      run(async () => {
        if (status === "open" && active?.metaPurchase?.ok) {
          const proceed = window.confirm(
            "The purchase was already reported to Meta and cannot be taken back. Reopen this client anyway?"
          );
          if (!proceed) return;
        }
        if (await persist({ status })) setNotice({ tone: "ok", text: `Marked as “${CLIENT_STATUS_LABELS[status]}”.` });
      }),
    [active, persist, run]
  );

  const markPurchased = useCallback(
    () =>
      run(async () => {
        if (!Number(draft.price)) {
          setNotice({ tone: "error", text: "Enter the sale price first — Meta needs the purchase value." });
          return;
        }
        // Save first, so Meta receives exactly what is on screen.
        const saved = await persist();
        if (!saved) return;

        const res = await fetch(adminApiUrl(`/api/admin/clients/${encodeURIComponent(saved.id)}/purchase`), {
          method: "POST",
          headers: authHeaders
        });
        const json = (await res.json()) as ClientResponse;
        if (!res.ok || !json.ok || !json.client) {
          setNotice({ tone: "error", text: json.error || "Purchase could not be recorded." });
          return;
        }
        applyClient(json.client);
        const meta = json.client.metaPurchase;
        if (json.alreadySent) setNotice({ tone: "ok", text: "Marked as bought. Purchase was already sent to Meta earlier." });
        else if (meta?.ok) setNotice({ tone: "ok", text: "Marked as bought. Purchase event sent to Meta." });
        else setNotice({ tone: "error", text: `Marked as bought, but Meta rejected the event: ${meta?.error ?? "unknown error"}` });
      }),
    [applyClient, authHeaders, draft.price, persist, run]
  );

  const remove = useCallback(
    () =>
      run(async () => {
        if (!active || !window.confirm(`Delete ${active.name}? This cannot be undone.`)) return;
        const res = await fetch(adminApiUrl(`/api/admin/clients/${encodeURIComponent(active.id)}`), {
          method: "DELETE",
          headers: authHeaders
        });
        if (!res.ok) {
          setNotice({ tone: "error", text: "Client could not be deleted." });
          return;
        }
        setClients((current) => current.filter((item) => item.id !== active.id));
        setActiveId("");
        setDraft(EMPTY_DRAFT);
        setNotice({ tone: "ok", text: "Deleted." });
      }),
    [active, authHeaders, run]
  );

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: clients.length, open: 0, purchased: 0, lost: 0 };
    for (const client of clients) result[client.status] += 1;
    return result;
  }, [clients]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (filter !== "all" && client.status !== filter) return false;
      if (!needle) return true;
      return [client.name, client.phone, client.email, client.vehicleTitle]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [clients, filter, query]);

  if (!passcode) {
    return (
      <main className="admin-shell">
        <section className="admin-gate">
          <h1>Clients sign-in</h1>
          <p>Enter the manager passcode to manage clients.</p>
          <form onSubmit={onPasscodeSubmit} className="admin-gate-form">
            <label htmlFor="admin-passcode" className="admin-gate-label">
              Passcode
            </label>
            <input
              id="admin-passcode"
              type="password"
              value={passInput}
              onChange={(event) => setPassInput(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            {authError ? <p className="admin-gate-error">{authError}</p> : null}
            <button type="submit" className="btn btn-primary btn-block">
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  const status = active?.status ?? "open";

  return (
    <main className="admin-shell inventory-admin clients-admin">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">Carviondealer · Sales</p>
          <h1>Clients</h1>
          {!metaConfigured ? (
            <p className="admin-auth-warning">
              Meta Conversions API is not configured — purchases are saved but not reported.
            </p>
          ) : metaTestMode ? (
            <p className="inventory-admin-storage">Meta test mode: purchases go to Test Events only.</p>
          ) : null}
        </div>
        <div className="admin-head-actions">
          <a className="admin-link" href="/admin/inventory">
            Inventory
          </a>
          <button type="button" className="admin-link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="inventory-admin-body">
        <aside className="inventory-admin-list">
          <button type="button" className="inventory-admin-new" onClick={startNew}>
            Add client
          </button>
          <input
            className="clients-search"
            type="search"
            placeholder="Search name, phone, email, car"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="clients-filters" role="tablist">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? "is-active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label} <b>{counts[item.id]}</b>
              </button>
            ))}
          </div>
          {loading && !clients.length ? <p className="admin-empty">Loading clients...</p> : null}
          {!loading && !visible.length ? (
            <p className="inventory-admin-help clients-empty">{clients.length ? "No matches." : "No clients yet."}</p>
          ) : null}
          <ul>
            {visible.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  className={client.id === activeId ? "is-active" : ""}
                  onClick={() => selectClient(client)}
                >
                  <span>{client.name}</span>
                  <small className="clients-list-meta">
                    <i className={`clients-status is-${client.status}`}>{CLIENT_STATUS_LABELS[client.status]}</i>
                    {client.vehicleTitle ? ` · ${client.vehicleTitle}` : ""}
                    {client.price ? ` · ${formatUsd(client.price)}` : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="inventory-admin-editor">
          <div className="inventory-admin-panel">
            <div className="inventory-admin-panel-head">
              <div>
                <p className="admin-eyebrow">
                  {active ? `Added ${formatDate(active.createdAt)}` : "New client"}
                </p>
                <h2>{draft.name || "Unnamed client"}</h2>
              </div>
              <div className="inventory-admin-actions">
                {active ? (
                  <button type="button" className="btn danger" onClick={remove} disabled={busy}>
                    Delete
                  </button>
                ) : null}
                <button type="button" className="btn" onClick={save} disabled={busy || !dirty}>
                  {busy ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {notice ? (
              <p className={`clients-notice is-${notice.tone}`} role="status">
                {notice.text}
              </p>
            ) : null}

            <details className="clients-paste" open={pasteOpen} onToggle={(event) => setPasteOpen(event.currentTarget.open)}>
              <summary>Paste client details</summary>
              <textarea
                rows={5}
                placeholder={"Michael Macke\n(513) 441-3780\nmichael@example.com\n$81,600\nhttps://carviondealer.com/inventory/..."}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
              />
              <button type="button" className="btn ghost compact" onClick={applyPaste} disabled={!pasteText.trim()}>
                Fill form
              </button>
            </details>

            <div className="inventory-form-grid">
              <Field label="Name *" value={draft.name} onChange={(value) => updateDraft("name", value)} autoComplete="off" />
              <Field label="Phone" type="tel" value={draft.phone} onChange={(value) => updateDraft("phone", value)} />
              <Field label="Email" type="email" value={draft.email} onChange={(value) => updateDraft("email", value)} />
              <Field label="City" value={draft.city} onChange={(value) => updateDraft("city", value)} />
              <Field label="State (2 letters)" value={draft.state} onChange={(value) => updateDraft("state", value)} />
              <Field label="ZIP" value={draft.zip} onChange={(value) => updateDraft("zip", value)} />
              <label className="inventory-field">
                <span>Vehicle from inventory</span>
                <select value={draft.vehicleSlug} onChange={(event) => pickVehicle(event.target.value)}>
                  <option value="">— Not selected —</option>
                  {draft.vehicleSlug && !vehicles.some((vehicle) => vehicle.slug === draft.vehicleSlug) ? (
                    <option value={draft.vehicleSlug}>{draft.vehicleTitle || draft.vehicleSlug}</option>
                  ) : null}
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.slug} value={vehicle.slug}>
                      {vehicle.title}
                      {vehicle.status === "sold" ? " (sold)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Vehicle" value={draft.vehicleTitle} onChange={(value) => updateDraft("vehicleTitle", value)} />
              <Field label="Sale price, USD" type="number" value={draft.price} onChange={(value) => updateDraft("price", value)} />
              <label className="inventory-field wide">
                <span>Link to the bought vehicle</span>
                <div className="clients-link-row">
                  <input
                    type="url"
                    inputMode="url"
                    placeholder={`${site.url}/inventory/...`}
                    value={draft.vehicleUrl}
                    onChange={(event) => changeVehicleUrl(event.target.value)}
                  />
                  {normalizeVehicleUrl(draft.vehicleUrl) ? (
                    <a
                      className="btn ghost compact"
                      href={normalizeVehicleUrl(draft.vehicleUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </label>
              <label className="inventory-field wide">
                <span>Notes</span>
                <textarea rows={5} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="inventory-admin-panel clients-outcome">
            <p className="admin-eyebrow">Outcome</p>
            <div className="clients-outcome-head">
              <h2>
                <i className={`clients-status is-${status}`}>{CLIENT_STATUS_LABELS[status]}</i>
              </h2>
              {active?.purchasedAt ? (
                <span className="inventory-admin-help">Bought {formatDate(active.purchasedAt)}</span>
              ) : null}
            </div>

            <div className="clients-outcome-actions">
              {status !== "purchased" ? (
                <button type="button" className="btn clients-buy" onClick={markPurchased} disabled={busy}>
                  {busy ? "Sending..." : "Bought — send Purchase"}
                </button>
              ) : !active?.metaPurchase?.ok ? (
                <button type="button" className="btn clients-buy" onClick={markPurchased} disabled={busy}>
                  {busy ? "Sending..." : "Retry sending Purchase"}
                </button>
              ) : null}
              {status !== "lost" ? (
                <button type="button" className="btn ghost" onClick={() => setStatus("lost")} disabled={busy}>
                  Didn&apos;t buy
                </button>
              ) : null}
              {status !== "open" && active ? (
                <button type="button" className="btn ghost" onClick={() => setStatus("open")} disabled={busy}>
                  Back to in progress
                </button>
              ) : null}
            </div>

            <MetaStatus client={active} />
          </div>
        </section>
      </section>
    </main>
  );
}

function MetaStatus({ client }: { client?: ClientRecord }) {
  const log = client?.metaPurchase;
  if (!log) {
    return (
      <p className="inventory-admin-help">
        “Bought” saves the client and reports a Purchase event with the sale price and the vehicle link to Meta,
        matched to the ad by the client&apos;s hashed phone, email and name. Each client is reported once.
      </p>
    );
  }
  return (
    <div className={`clients-meta is-${log.ok ? "ok" : "error"}`}>
      {log.ok ? "Purchase sent to Meta" : "Meta did not accept the Purchase"} · {formatDate(log.attemptedAt)}
      {log.value ? ` · ${formatUsd(log.value)}` : ""}
      {log.withAdClick ? " · with ad click id" : ""}
      {log.testEventCode ? " · test event" : ""}
      {log.error ? <span>{log.error}</span> : null}
      {log.payload ? (
        <details className="clients-payload">
          <summary>Sent payload</summary>
          <pre>{JSON.stringify(log.payload, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  autoComplete,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="inventory-field">
      <span>{label}</span>
      <input type={type} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/**
 * Sets the vehicle link and keeps the listing fields in step with it: a link to
 * one of our listings picks that vehicle; leaving such a link unpicks it.
 * `keepPrice` stops the listing price from filling an empty price (a paste brings its own).
 */
function withVehicleUrl(current: Draft, value: string, vehicles: Vehicle[], keepPrice = false): Draft {
  const slug = vehicleSlugFromUrl(value);
  const vehicle = slug ? vehicles.find((item) => item.slug === slug) : undefined;
  if (vehicle) {
    return {
      ...current,
      vehicleUrl: value,
      vehicleSlug: vehicle.slug,
      vehicleTitle: vehicle.title,
      price: vehicle.price && !current.price && !keepPrice ? String(vehicle.price) : current.price
    };
  }
  const leftListing = current.vehicleSlug && vehicleSlugFromUrl(current.vehicleUrl) === current.vehicleSlug;
  return { ...current, vehicleUrl: value, vehicleSlug: slug || (leftListing ? "" : current.vehicleSlug) };
}

/** Reads a pasted block like "name / phone / email / $price / link", one value per line, in any order. */
function parseClientDetails(text: string): Partial<Draft> {
  const out: Partial<Draft> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const digits = line.replace(/\D/g, "");

    if (!out.vehicleUrl && /^(https?:\/\/|www\.|carviondealer\.com\/)/i.test(line)) {
      out.vehicleUrl = line;
    } else if (!out.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(line)) {
      out.email = line;
    } else if (!out.price && /^\$\s*[\d,]+(\.\d{1,2})?$/.test(line)) {
      out.price = String(Number(line.replace(/[^\d.]/g, "")));
    } else if (!out.phone && /^[+\d\s().-]+$/.test(line) && digits.length >= 10 && digits.length <= 15) {
      out.phone = line;
    } else if (!out.price && /^[\d,]+(\.\d{1,2})?$/.test(line)) {
      out.price = String(Number(line.replace(/,/g, "")));
    } else if (!out.name && /\p{L}/u.test(line)) {
      out.name = line;
    }
  }
  return out;
}

function listingUrl(vehicle: Vehicle) {
  return `${site.url}/${vehicle.status === "sold" ? "sold" : "inventory"}/${encodeURIComponent(vehicle.slug)}`;
}

function toDraft(client: ClientRecord): Draft {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email,
    city: client.city,
    state: client.state,
    zip: client.zip,
    vehicleSlug: client.vehicleSlug,
    vehicleTitle: client.vehicleTitle,
    vehicleUrl: client.vehicleUrl ?? "",
    price: client.price ? String(client.price) : "",
    notes: client.notes
  };
}

function sameDraft(a: Draft, b: Draft) {
  return (Object.keys(a) as Array<keyof Draft>).every((key) => a[key].trim() === b[key].trim());
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function setPasscodeCookie(passcode: string) {
  document.cookie = `${PASSCODE_COOKIE}=${encodeURIComponent(passcode)}; Path=/api; Secure; SameSite=Strict`;
}

function clearPasscodeCookie() {
  document.cookie = `${PASSCODE_COOKIE}=; Path=/api; Max-Age=0; Secure; SameSite=Strict`;
}

function isCustomDomain(hostname: string) {
  return hostname === "carviondealer.com" || hostname === "www.carviondealer.com";
}

function adminApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return isCustomDomain(window.location.hostname) ? `${ADMIN_API_ORIGIN}${path}` : path;
}

function buildAuthHeaders(passcode: string | null) {
  const headers: Record<string, string> = {};
  if (passcode) {
    headers["x-live-chat-admin-passcode"] = passcode;
    headers.Authorization = `Bearer ${passcode}`;
  }
  return headers;
}
