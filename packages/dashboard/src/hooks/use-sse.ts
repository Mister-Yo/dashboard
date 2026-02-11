"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";

/** SSE event type → React Query keys to invalidate */
const EVENT_KEY_MAP: Record<string, string[][]> = {
  "task:created": [["tasks"], ["activity"]],
  "task:updated": [["tasks"], ["activity"]],
  "task:assigned": [["tasks"], ["agents"], ["activity"]],
  "task:failed": [["tasks"], ["activity"]],
  "agent:heartbeat": [["agents"], ["activity"]],
  "knowledge:created": [["knowledge"]],
  "knowledge:updated": [["knowledge"]],
  "knowledge:deleted": [["knowledge"]],
  "project:created": [["projects"]],
  "project:updated": [["projects"]],
  "project:deleted": [["projects"]],
  "evaluation:created": [["evaluations"]],
  "strategy:updated": [["strategy-changes"], ["projects"]],
  "activity:logged": [["activity"]],
  "coord:thread:created": [["coord-threads"]],
  "coord:message:created": [["coord-messages"]],
};

/**
 * Connects to /api/sse/stream and invalidates React Query caches
 * on real-time events. Auto-reconnects with exponential backoff.
 */
export function useSSE() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    function connect() {
      const base = getApiUrl();
      const url = base ? `${base}/api/sse/stream` : "/api/sse/stream";
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("init", () => {
        retryRef.current = 0;
        // Sync initial state
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      });

      // Register handlers for each event type
      for (const [eventType, queryKeys] of Object.entries(EVENT_KEY_MAP)) {
        es.addEventListener(eventType, () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        });
      }

      es.onerror = () => {
        es.close();
        // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  }, [queryClient]);
}
