"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import type { Vehicle, VehicleStatus } from "@/src/lib/vehicles";

type InventoryResponse = {
  ok?: boolean;
  storage?: string;
  vehicles?: Vehicle[];
  error?: string;
};

const PASSCODE_KEY = "carviondealer.liveChat.adminPasscode";
const PASSCODE_COOKIE = "carviondealer_live_chat_admin";
const ADMIN_API_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || "";

const EMPTY_VEHICLE: Vehicle = {
  slug: "",
  title: "",
  make: "",
  model: "",
  description: "",
  summary: "",
  features: [],
  images: [],
  status: "available"
};

export function AdminInventory() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [storage, setStorage] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [draft, setDraft] = useState<Vehicle>(EMPTY_VEHICLE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCustomDomain(window.location.hostname)) {
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

  const loadInventory = useCallback(async () => {
    if (!passcode) return;
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch(adminApiUrl("/api/admin/inventory"), {
        cache: "no-store",
        headers: authHeaders
      });
      const json = (await res.json()) as InventoryResponse;
      if (res.status === 401) {
        signOut();
        setAuthError("The saved manager passcode was rejected.");
        return;
      }
      if (!res.ok || !json.ok) {
        setNotice(json.error || "Inventory could not be loaded.");
        return;
      }
      const nextVehicles = json.vehicles ?? [];
      setVehicles(nextVehicles);
      setStorage(json.storage ?? "");
      const nextActive = activeSlug || nextVehicles[0]?.slug || "";
      setActiveSlug(nextActive);
      setDraft(nextVehicles.find((vehicle) => vehicle.slug === nextActive) ?? EMPTY_VEHICLE);
    } catch {
      setNotice("Network error while loading inventory.");
    } finally {
      setLoading(false);
    }
  }, [activeSlug, authHeaders, passcode]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const onPasscodeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = passInput.trim();
      if (!trimmed) {
        setAuthError("Please enter the manager passcode.");
        return;
      }

      setAuthError("");
      const res = await fetch(adminApiUrl("/api/admin/inventory"), {
        cache: "no-store",
        headers: buildAuthHeaders(trimmed)
      });
      if (res.status === 401) {
        setAuthError("That passcode didn't work. Try again.");
        return;
      }
      if (!res.ok) {
        setAuthError("The inventory backend is not reachable right now.");
        return;
      }

      window.sessionStorage.setItem(PASSCODE_KEY, trimmed);
      setPasscodeCookie(trimmed);
      setPasscode(trimmed);
      setPassInput("");
    },
    [passInput]
  );

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(PASSCODE_KEY);
    clearPasscodeCookie();
    setPasscode(null);
    setVehicles([]);
    setActiveSlug("");
    setDraft(EMPTY_VEHICLE);
  }, []);

  const selectVehicle = useCallback(
    (slug: string) => {
      const selected = vehicles.find((vehicle) => vehicle.slug === slug);
      if (!selected) return;
      setActiveSlug(slug);
      setDraft(selected);
      setNotice("");
    },
    [vehicles]
  );

  const startNew = useCallback(() => {
    setActiveSlug("");
    setDraft({ ...EMPTY_VEHICLE, status: "available" });
    setNotice("");
  }, []);

  const updateDraft = useCallback(<K extends keyof Vehicle>(key: K, value: Vehicle[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const moveImage = useCallback((index: number, offset: -1 | 1) => {
    setDraft((current) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= current.images.length) return current;
      const images = [...current.images];
      const [image] = images.splice(index, 1);
      images.splice(nextIndex, 0, image);
      return { ...current, images };
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index)
    }));
  }, []);

  const updateImage = useCallback((index: number, nextImage: Vehicle["images"][number]) => {
    setDraft((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => (imageIndex === index ? nextImage : image))
    }));
  }, []);

  const updateImageFocus = useCallback(
    (index: number, axis: "focusX" | "focusY", value: number) => {
      setDraft((current) => ({
        ...current,
        images: current.images.map((image, imageIndex) =>
          imageIndex === index ? { ...image, [axis]: clampFocus(value) } : image
        )
      }));
    },
    []
  );

  const startImageDrag = useCallback((index: number, event: DragEvent<HTMLDivElement>) => {
    setDragImageIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }, []);

  const dropImage = useCallback(
    (index: number, event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rawIndex = event.dataTransfer.getData("text/plain");
      const fromIndex = rawIndex ? Number(rawIndex) : dragImageIndex;
      setDragImageIndex(null);
      if (fromIndex === null || Number.isNaN(fromIndex) || fromIndex === index) return;

      setDraft((current) => {
        if (fromIndex < 0 || fromIndex >= current.images.length || index >= current.images.length) {
          return current;
        }
        const images = [...current.images];
        const [image] = images.splice(fromIndex, 1);
        images.splice(index, 0, image);
        return { ...current, images };
      });
    },
    [dragImageIndex]
  );

  const saveDraft = useCallback(async () => {
    if (!passcode) return;
    if (!draft.title.trim()) {
      setNotice("Title is required.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const method = activeSlug ? "PATCH" : "POST";
      const path = activeSlug
        ? `/api/admin/inventory/${encodeURIComponent(activeSlug)}`
        : "/api/admin/inventory";
      const res = await fetch(adminApiUrl(path), {
        method,
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = (await res.json()) as { ok?: boolean; vehicle?: Vehicle; error?: string };
      if (!res.ok || !json.ok || !json.vehicle) {
        setNotice(json.error || "Vehicle could not be saved.");
        return;
      }
      setNotice("Saved.");
      setActiveSlug(json.vehicle.slug);
      setDraft(json.vehicle);
      await loadInventory();
    } catch {
      setNotice("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }, [activeSlug, authHeaders, draft, loadInventory, passcode]);

  const deleteDraft = useCallback(async () => {
    if (!passcode || !activeSlug) return;
    if (!window.confirm(`Delete ${draft.title}?`)) return;

    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(adminApiUrl(`/api/admin/inventory/${encodeURIComponent(activeSlug)}`), {
        method: "DELETE",
        headers: authHeaders
      });
      if (!res.ok) {
        setNotice("Vehicle could not be deleted.");
        return;
      }
      setNotice("Deleted.");
      setActiveSlug("");
      setDraft(EMPTY_VEHICLE);
      await loadInventory();
    } finally {
      setSaving(false);
    }
  }, [activeSlug, authHeaders, draft.title, loadInventory, passcode]);

  const uploadImages = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!passcode || !activeSlug) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      if (data.getAll("images").length === 0) return;

      setImageUploading(true);
      setNotice("");
      try {
        const res = await fetch(
          adminApiUrl(`/api/admin/inventory/${encodeURIComponent(activeSlug)}/images`),
          {
            method: "POST",
            headers: authHeaders,
            body: data
          }
        );
        const json = (await res.json()) as { ok?: boolean; vehicle?: Vehicle; error?: string };
        if (!res.ok || !json.ok || !json.vehicle) {
          setNotice(json.error || "Images could not be uploaded.");
          return;
        }
        form.reset();
        setDraft(json.vehicle);
        setNotice("Images uploaded.");
        await loadInventory();
      } finally {
        setImageUploading(false);
      }
    },
    [activeSlug, authHeaders, loadInventory, passcode]
  );

  const importArchive = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!passcode) return;
      const form = event.currentTarget;
      const data = new FormData(form);

      setImporting(true);
      setNotice("");
      try {
        const res = await fetch(adminApiUrl("/api/admin/inventory/import"), {
          method: "POST",
          headers: authHeaders,
          body: data
        });
        const json = (await res.json()) as { ok?: boolean; imported?: number; error?: string };
        if (!res.ok || !json.ok) {
          setNotice(json.error || "Archive could not be imported.");
          return;
        }
        form.reset();
        setNotice(`Imported ${json.imported ?? 0} vehicle(s).`);
        await loadInventory();
      } finally {
        setImporting(false);
      }
    },
    [authHeaders, loadInventory, passcode]
  );

  if (!passcode) {
    return (
      <main className="admin-shell">
        <section className="admin-gate">
          <h1>Inventory sign-in</h1>
          <p>Enter the manager passcode to edit vehicles.</p>
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

  return (
    <main className="admin-shell inventory-admin">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">Carviondealer · Inventory</p>
          <h1>Inventory manager</h1>
          {notice ? <p className="admin-auth-warning">{notice}</p> : null}
          {storage ? <p className="inventory-admin-storage">Storage: {storage}</p> : null}
        </div>
        <div className="admin-head-actions">
          <a className="admin-link" href="/admin/clients">
            Clients
          </a>
          <a className="admin-link" href="/admin/live-chat">
            Live chat
          </a>
          <button type="button" className="btn ghost" onClick={startNew}>
            New vehicle
          </button>
          <button type="button" className="admin-link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="inventory-admin-body">
        <aside className="inventory-admin-list">
          <button type="button" className="inventory-admin-new" onClick={startNew}>
            Add vehicle
          </button>
          {loading ? <p className="admin-empty">Loading inventory...</p> : null}
          <ul>
            {vehicles.map((vehicle) => (
              <li key={vehicle.slug}>
                <button
                  type="button"
                  className={vehicle.slug === activeSlug ? "is-active" : ""}
                  onClick={() => selectVehicle(vehicle.slug)}
                >
                  <span>{vehicle.title}</span>
                  <small>
                    {vehicle.status}
                    {vehicle.price ? ` · $${vehicle.price.toLocaleString("en-US")}` : ""}
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
                <p className="admin-eyebrow">{activeSlug ? "Edit listing" : "New listing"}</p>
                <h2>{draft.title || "Untitled vehicle"}</h2>
              </div>
              <div className="inventory-admin-actions">
                {activeSlug ? (
                  <button type="button" className="btn danger" onClick={deleteDraft} disabled={saving}>
                    Delete
                  </button>
                ) : null}
                <button type="button" className="btn" onClick={saveDraft} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="inventory-form-grid">
              <Field label="Title" value={draft.title} onChange={(value) => updateDraft("title", value)} />
              <Field label="Slug" value={draft.slug} onChange={(value) => updateDraft("slug", value)} />
              <Field label="Year" type="number" value={draft.year ?? ""} onChange={(value) => updateDraft("year", numberValue(value))} />
              <Field label="Make" value={draft.make} onChange={(value) => updateDraft("make", value)} />
              <Field label="Model" value={draft.model} onChange={(value) => updateDraft("model", value)} />
              <Field label="Trim" value={draft.trim ?? ""} onChange={(value) => updateDraft("trim", value)} />
              <Field label="Price" type="number" value={draft.price ?? ""} onChange={(value) => updateDraft("price", numberValue(value))} />
              <label className="inventory-field">
                <span>Status</span>
                <select
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value as VehicleStatus)}
                >
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                </select>
              </label>
              <Field label="Mileage" type="number" value={draft.mileage ?? ""} onChange={(value) => updateDraft("mileage", numberValue(value))} />
              <Field label="Stock #" value={draft.stockNumber ?? ""} onChange={(value) => updateDraft("stockNumber", value)} />
              <Field label="VIN" value={draft.vin ?? ""} onChange={(value) => updateDraft("vin", value)} />
              <Field label="Body" value={draft.bodyType ?? ""} onChange={(value) => updateDraft("bodyType", value)} />
              <Field label="Engine" value={draft.engine ?? ""} onChange={(value) => updateDraft("engine", value)} />
              <Field label="Transmission" value={draft.transmission ?? ""} onChange={(value) => updateDraft("transmission", value)} />
              <Field label="Drivetrain" value={draft.drivetrain ?? ""} onChange={(value) => updateDraft("drivetrain", value)} />
              <Field label="Fuel" value={draft.fuelType ?? ""} onChange={(value) => updateDraft("fuelType", value)} />
              <Field label="Exterior" value={draft.exteriorColor ?? ""} onChange={(value) => updateDraft("exteriorColor", value)} />
              <Field label="Interior" value={draft.interiorColor ?? ""} onChange={(value) => updateDraft("interiorColor", value)} />
              <label className="inventory-field wide">
                <span>Description</span>
                <textarea
                  rows={7}
                  value={draft.description}
                  onChange={(event) => updateDraft("description", event.target.value)}
                />
              </label>
              <label className="inventory-field wide">
                <span>Features, one per line</span>
                <textarea
                  rows={4}
                  value={draft.features.join("\n")}
                  onChange={(event) =>
                    updateDraft(
                      "features",
                      event.target.value
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="inventory-admin-grid">
            <section className="inventory-admin-panel inventory-photo-panel">
              <p className="admin-eyebrow">Photos</p>
              <div className="inventory-photo-head">
                <h2>{draft.images.length} image(s)</h2>
                <button type="button" className="btn ghost compact" onClick={saveDraft} disabled={saving}>
                  {saving ? "Saving..." : "Save photo changes"}
                </button>
              </div>

              <form className="inventory-upload-form" onSubmit={uploadImages}>
                <input type="file" name="images" accept="image/jpeg,image/png" multiple disabled={!activeSlug} />
                <button type="submit" className="btn" disabled={!activeSlug || imageUploading}>
                  {imageUploading ? "Uploading..." : "Upload images"}
                </button>
              </form>

              {draft.images.length ? (
                <div className="inventory-photo-list" aria-label="Listing photos">
                  {draft.images.map((image, index) => (
                    <div
                      className={`inventory-photo-card${index === dragImageIndex ? " is-dragging" : ""}`}
                      draggable
                      key={`${image.src}-${index}`}
                      onDragStart={(event) => startImageDrag(index, event)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragEnd={() => setDragImageIndex(null)}
                      onDrop={(event) => dropImage(index, event)}
                    >
                      <div className="inventory-photo-preview">
                        <img src={image.src} alt={image.alt} style={{ objectPosition: imageObjectPosition(image) }} />
                        <span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
                      </div>
                      <div className="inventory-photo-controls">
                        <div className="inventory-photo-buttons">
                          <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>
                            Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(index, 1)}
                            disabled={index === draft.images.length - 1}
                          >
                            Move down
                          </button>
                          <button type="button" className="danger-text" onClick={() => removeImage(index)}>
                            Remove
                          </button>
                        </div>
                        <label className="inventory-field">
                          <span>Alt text</span>
                          <input
                            type="text"
                            value={image.alt}
                            onChange={(event) => updateImage(index, { ...image, alt: event.target.value })}
                          />
                        </label>
                        <label className="inventory-range">
                          <span>Horizontal frame</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={image.focusX ?? 50}
                            onChange={(event) => updateImageFocus(index, "focusX", Number(event.target.value))}
                          />
                        </label>
                        <label className="inventory-range">
                          <span>Vertical frame</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={image.focusY ?? 50}
                            onChange={(event) => updateImageFocus(index, "focusY", Number(event.target.value))}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inventory-admin-help">Upload photos after saving this vehicle once.</p>
              )}
            </section>

            <form className="inventory-admin-panel" onSubmit={importArchive}>
              <p className="admin-eyebrow">Batch import</p>
              <h2>Import ZIP</h2>
              <p className="inventory-admin-help">
                ZIP should contain one folder per car, with photos plus optional s.txt specs and o.txt
                description.
              </p>
              <input type="file" name="archive" accept=".zip,application/zip" required />
              <select name="status" defaultValue="available">
                <option value="available">Import as available</option>
                <option value="sold">Import as sold</option>
              </select>
              <button type="submit" className="btn" disabled={importing}>
                {importing ? "Importing..." : "Import archive"}
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange
}: {
  label: string;
  value: string | number;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="inventory-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function numberValue(value: string) {
  return value === "" ? undefined : Number(value);
}

function clampFocus(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function imageObjectPosition(image: Vehicle["images"][number]) {
  return `${image.focusX ?? 50}% ${image.focusY ?? 50}%`;
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
