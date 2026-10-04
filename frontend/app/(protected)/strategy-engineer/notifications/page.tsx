import type { Metadata } from "next";
import { SharedNotificationsPage } from "@/components/notifications/SharedNotificationsPage";

export const metadata: Metadata = { title: "Notifications | Strategy Engineer" };

export default function StrategyEngineerNotificationsPage() {
  return <SharedNotificationsPage roleTitle="Strategy Engineer" />;
}
