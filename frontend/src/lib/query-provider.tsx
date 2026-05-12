"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * React Query Provider
 * --------------------
 * Client component that wraps the app with TanStack React Query's context.
 * Instantiates a stable QueryClient per browser session to avoid
 * sharing cache between requests in SSR.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/ssr
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Data is considered fresh for 60 seconds.
             * After this, a background refetch will be triggered.
             */
            staleTime: 60 * 1000,

            /**
             * Cached data is garbage-collected after 5 minutes of inactivity.
             */
            gcTime: 5 * 60 * 1000,

            /**
             * Retry failed queries up to 2 times with exponential backoff.
             */
            retry: 2,

            /**
             * Refetch stale queries when the window regains focus.
             */
            refetchOnWindowFocus: true,
          },
          mutations: {
            /**
             * Retry failed mutations once.
             */
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
