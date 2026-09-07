import type { Metadata } from "next";
import { DashboardStub } from "@/components/DashboardStub";
export const metadata: Metadata = { title: "Mechanic Dashboard" };
export default function MechanicPage() { return <DashboardStub />; }
