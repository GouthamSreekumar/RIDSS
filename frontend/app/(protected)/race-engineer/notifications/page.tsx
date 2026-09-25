import type { Metadata } from "next";
import { SharedNotificationsPage } from "@/components/notifications/SharedNotificationsPage";

export const metadata: Metadata = { title: "Notifications | Race Engineer" };

export default function RaceEngineerNotificationsPage() {
  return <SharedNotificationsPage roleTitle="Race Engineer" />;
}
