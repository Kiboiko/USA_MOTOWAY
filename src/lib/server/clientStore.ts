import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  normalizeVehicleUrl,
  vehicleSlugFromUrl,
  type ClientInput,
  type ClientRecord,
  type ClientStatus
} from "@/src/lib/clients";
import { isValidEmail, EMAIL_HINT } from "@/src/lib/validation";
import { formatUsPhone } from "@/src/lib/phone";

// Client records hold names, phones and emails, so they stay on the server's
// disk (never in public blob storage) and the file is readable by root only.
const DATA_FILE = process.env.CLIENTS_DATA_FILE || join(process.cwd(), ".crm-data", "clients.json");

export class ClientInputError extends Error {}

// Every write is read-modify-write on one JSON file, so writes are serialised.
// The chain lives on globalThis because Next can load this module more than
// once in the same process (one copy per route bundle).
const lockHolder = globalThis as typeof globalThis & { __clientStoreLock?: Promise<unknown> };

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = lockHolder.__clientStoreLock ?? Promise.resolve();
  const run = previous.then(task, task);
  lockHolder.__clientStoreLock = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<ClientRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as ClientRecord[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    // A corrupt file must not be silently replaced by an empty list.
    throw error;
  }
}

async function writeAll(clients: ClientRecord[]) {
  await mkdir(dirname(DATA_FILE), { recursive: true, mode: 0o700 });
  // Write-then-rename, so a crash mid-write can never leave a truncated file.
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(clients, null, 2), { mode: 0o600 });
  await rename(tmp, DATA_FILE);
}

function sortClients(clients: ClientRecord[]) {
  return [...clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listClients() {
  return sortClients(await readAll());
}

export async function getClient(id: string) {
  return (await readAll()).find((client) => client.id === id);
}

export function createClient(input: ClientInput) {
  return withLock(async () => {
    const clients = await readAll();
    const now = new Date().toISOString();
    const fields = sanitizeClientInput(input);
    const client: ClientRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      zip: "",
      vehicleSlug: "",
      vehicleTitle: "",
      vehicleUrl: "",
      notes: "",
      ...fields,
      status: fields.status === "lost" ? "lost" : "open"
    };
    assertContactable(client);
    await writeAll([client, ...clients]);
    return client;
  });
}

export function updateClient(id: string, input: ClientInput) {
  return mutateClient(id, (current) => {
    const fields = sanitizeClientInput(input);
    const next: ClientRecord = { ...current, ...fields };
    // "Bought" is only ever set by the purchase flow, which also reports it to
    // Meta; reopening a bought client keeps its purchase log so a second
    // "Bought" click cannot report the same sale twice.
    if (fields.status === "purchased" && current.status !== "purchased") next.status = current.status;
    if (next.status !== "purchased") delete next.purchasedAt;
    assertContactable(next);
    return next;
  });
}

/** Applies a change to one record under the store lock; returns undefined if it does not exist. */
export function mutateClient(id: string, change: (current: ClientRecord) => ClientRecord) {
  return withLock(async () => {
    const clients = await readAll();
    const index = clients.findIndex((client) => client.id === id);
    if (index === -1) return undefined;
    const next = { ...change(clients[index]), id, updatedAt: new Date().toISOString() };
    clients[index] = next;
    await writeAll(clients);
    return next;
  });
}

export function deleteClient(id: string) {
  return withLock(async () => {
    const clients = await readAll();
    const next = clients.filter((client) => client.id !== id);
    if (next.length === clients.length) return false;
    await writeAll(next);
    return true;
  });
}

function assertContactable(client: ClientRecord) {
  if (!client.name) throw new ClientInputError("Client name is required.");
  if (!client.phone && !client.email) {
    throw new ClientInputError("Add a phone or an email — Meta matches the purchase to the ad by them.");
  }
}

const STATUSES: ClientStatus[] = ["open", "purchased", "lost"];

function sanitizeClientInput(input: ClientInput): ClientInput {
  const out: ClientInput = {};
  const text = (key: keyof ClientInput, max: number) => {
    const value = input[key];
    if (value === undefined) return;
    (out as Record<string, unknown>)[key] = typeof value === "string" ? value.trim().slice(0, max) : "";
  };

  text("name", 200);
  text("phone", 80);
  text("email", 200);
  text("city", 120);
  text("state", 60);
  text("zip", 20);
  text("vehicleSlug", 200);
  text("vehicleTitle", 300);
  text("vehicleUrl", 1000);
  text("notes", 5000);

  if (out.vehicleUrl) {
    const url = normalizeVehicleUrl(out.vehicleUrl);
    if (!url) throw new ClientInputError("Vehicle link must be a web address, e.g. https://carviondealer.com/inventory/...");
    out.vehicleUrl = url;
    // A link to one of our listings identifies the car, so it also sets the slug Meta receives.
    const slug = vehicleSlugFromUrl(url);
    if (slug) out.vehicleSlug = slug;
  }

  if (out.email && !isValidEmail(out.email)) throw new ClientInputError(EMAIL_HINT);
  if (out.phone !== undefined && out.phone) {
    if (out.phone.replace(/\D/g, "").length < 7) throw new ClientInputError("Phone number looks incomplete.");
    // US numbers are stored in the same shape as the leads sheet; anything else is kept as typed.
    out.phone = formatUsPhone(out.phone) ?? out.phone;
  }

  if ("price" in input) {
    const raw = input.price as unknown;
    const price = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
    out.price = raw === undefined || raw === null || raw === "" || !Number.isFinite(price) || price <= 0 ? undefined : Math.round(price * 100) / 100;
  }

  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) throw new ClientInputError("Unknown status.");
    out.status = input.status;
  }

  return out;
}
