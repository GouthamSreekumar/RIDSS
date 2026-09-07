import type { Metadata } from "next";
import { DashboardStub } from "@/components/DashboardStub";
export const metadata: Metadata = { title: "Driver Dashboard" };
export default function DriverPage() { return <DashboardStub />; }
