import type { Metadata } from "next";
import { SharedNotificationsPage } from "@/components/notifications/SharedNotificationsPage";

export const metadata: Metadata = { title: "Notifications | Mechanic" };

export default function MechanicNotificationsPage() {
  return <SharedNotificationsPage roleTitle="Mechanic" />;
}
