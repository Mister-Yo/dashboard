"use client";

import { useEffect, useMemo, useState } from "react";
import { coordFetch } from "@/lib/coord";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Thread {
  id: string;
  title: string;
  thread_type: string;
  created_at: string;
  created_by: string | null;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string | null;
  message_type: string;
  payload: Record<string, unknown> | string | null;
  created_at: string;
}

const CURRENT_SENDER = "CODE";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function messageText(payload: Message["payload"]) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && "text" in payload) {
    const text = payload.text;
    return typeof text === "string" ? text : JSON.stringify(payload);
  }
  return JSON.stringify(payload);
}

export default function CoordinationPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadThreads() {
      try {
        setLoadingThreads(true);
        const data = await coordFetch<Thread[]>("/api/coord/threads");
        setThreads(data);
        if (!activeThreadId && data.length > 0) {
          setActiveThreadId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load threads");
      } finally {
        setLoadingThreads(false);
      }
    }
    loadThreads();
  }, [activeThreadId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadMessages() {
      if (!activeThreadId) return;
      try {
        setLoadingMessages(true);
        const data = await coordFetch<Message[]>(
          `/api/coord/messages?thread_id=${activeThreadId}`
        );
        data.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
    timer = setInterval(loadMessages, 8000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  async function sendMessage() {
    if (!activeThreadId || !draft.trim()) return;
    const payload = {
      thread_id: activeThreadId,
      sender_id: CURRENT_SENDER,
      message_type: "note",
      payload: { text: draft.trim() },
    };

    try {
      const message = await coordFetch<Message>("/api/coord/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Coordinator error</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr] min-h-[calc(100vh-4rem)]">
      <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Threads
            </p>
            <h2 className="text-lg font-semibold">Coordination</h2>
          </div>
          <span className="text-xs text-[var(--muted)]">
            {threads.length}
          </span>
        </div>
        {loadingThreads ? (
          <p className="text-sm text-[var(--muted)]">Loading threads...</p>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={cn(
                  "w-full text-left rounded-xl border px-3 py-3 transition",
                  thread.id === activeThreadId
                    ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--card-border)] bg-[var(--surface-2)] text-[var(--foreground)] hover:border-[var(--accent)]"
                )}
              >
                <p className="text-sm font-medium leading-snug">
                  {thread.title || "Untitled thread"}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {thread.thread_type} · {formatTime(thread.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="flex flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden">
        <header className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Live Coordination
            </p>
            <h2 className="text-lg font-semibold">
              {activeThread?.title ?? "Select a thread"}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">Agent</p>
            <p className="text-sm font-medium">{CURRENT_SENDER}</p>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
          {loadingMessages ? (
            <p className="text-sm text-[var(--muted)]">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((message) => {
              const isSelf = message.sender_id === CURRENT_SENDER;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isSelf ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn("max-w-[70%] space-y-2")}>
                    <div
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                        isSelf
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                          : "bg-[var(--card)] border-[var(--card-border)]"
                      )}
                    >
                      {messageText(message.payload)}
                    </div>
                    <div
                      className={cn(
                        "text-xs text-[var(--muted)]",
                        isSelf ? "text-right" : "text-left"
                      )}
                    >
                      {message.sender_id ?? "unknown"} ·{" "}
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--card-border)] bg-[var(--surface-2)] p-4">
          <div className="flex items-end gap-3">
            <Textarea
              rows={3}
              placeholder="Write a coordination update..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              className="self-end"
              onClick={sendMessage}
              disabled={!draft.trim() || !activeThreadId}
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            Syncs every 8 seconds. Use for check-ins, blockers, and next steps.
          </p>
        </div>
      </section>
    </div>
  );
}
