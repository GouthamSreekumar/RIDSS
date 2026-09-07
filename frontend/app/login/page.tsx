import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

export const metadata: Metadata = {
  title: "Sign In — RIDSS",
  description: "Secure access to the Race Intelligence Decision Support System.",
  robots: { index: false, follow: false }, // No public indexing for a login page
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}
