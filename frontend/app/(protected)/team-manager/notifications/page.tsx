import type { Metadata } from "next";
import { SharedNotificationsPage } from "@/components/notifications/SharedNotificationsPage";

export const metadata: Metadata = { title: "Notifications | Team Manager" };

export default function TeamManagerNotificationsPage() {
  return <SharedNotificationsPage roleTitle="Team Manager" />;
}
