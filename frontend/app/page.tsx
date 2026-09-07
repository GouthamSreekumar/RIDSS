"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/features/auth/api/authApi";
import { getRouteForRole } from "@/features/auth/schemas/loginSchema";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    fetchMe()
      .then((user) => {
        const route = getRouteForRole(user.role);
        router.replace(route);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return null;
}
