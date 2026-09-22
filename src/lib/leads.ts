export type LeadPayload = {
  source: "support_chat" | "vehicle_inquiry";
  topic?: string;
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  price?: string;
  link?: string;
  purchaseSent?: string;
  vehicleTitle?: string;
  vehicleSlug?: string;
  pageUrl?: string;
  turnstileToken?: string;
};

export async function submitLead(payload: LeadPayload) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Lead submission failed");
  }

  return response.json() as Promise<{ ok: true }>;
}
