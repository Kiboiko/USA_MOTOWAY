import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLiveChat } from "./AdminLiveChat";

const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || "";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live chat manager",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminLiveChatPage() {
  const host = (await headers()).get("host") ?? "";

  if (host === "carviondealer.com" || host === "www.carviondealer.com") {
    if (ADMIN_ALIAS) {
      redirect(`${ADMIN_ALIAS}/admin/live-chat`);
    }
  }

  return <AdminLiveChat />;
}
