"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useSSE } from "@/hooks/use-sse";
import { ToastProvider } from "@/components/ui/toast";

function SSESubscriber() {
  useSSE();
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s — SSE handles freshness
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SSESubscriber />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
