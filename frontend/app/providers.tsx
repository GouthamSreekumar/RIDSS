"use client";

/**
 * Providers — wraps the application with TanStack Query context.
 * Kept in a separate 'use client' component so the root layout
 * can remain a Server Component.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
