/**
 * TanStack Query client configuration.
 *
 * Judgment call: retry=false on queries by default because retrying a 401
 * three times before redirecting would create a visible delay. Individual
 * mutations (like login) override this as needed.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000, // 30 seconds — balances freshness vs. request volume
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
