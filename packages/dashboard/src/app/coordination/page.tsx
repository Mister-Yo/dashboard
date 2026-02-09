"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { coordFetch } from "@/lib/coord";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface AuthContext {
  type: "api_key" | "jwt" | "anonymous";
  owner_type?: string;
  owner_id?: string;
  name?: string;
  role?: string;
}

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

function initialsFor(value: string | null | undefined) {
  if (!value) return "??";
  const cleaned = value.trim();
  if (!cleaned) return "??";
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.[0] ?? cleaned[0];
  const second = parts[1]?.[0] ?? cleaned[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

export default function CoordinationPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadType, setNewThreadType] = useState("general");
  const [creatingThread, setCreatingThread] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    async function loadAuth() {
      try {
        const data = await coordFetch<AuthContext>("/api/coord/auth/me");
        setAuth(data);
        setAuthRequired(false);
      } catch (err) {
        setAuth(null);
        setAuthRequired(true);
      }
    }
    loadAuth();
  }, []);

  useEffect(() => {
    if (authRequired) return;
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
  }, [activeThreadId, authRequired]);

  // Track whether user is near the bottom of the scroll container
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Track scroll position to decide if we should auto-scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "near bottom" if within 100px of the end
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let isFirstLoad = true;

    async function loadMessages() {
      if (!activeThreadId) return;
      if (authRequired) return;
      try {
        if (isFirstLoad) setLoadingMessages(true);
        const data = await coordFetch<Message[]>(
          `/api/coord/messages?thread_id=${activeThreadId}`
        );
        data.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        setMessages((prev) => {
          // Only update if messages actually changed (compare by length + last id)
          const lastPrevId = prev[prev.length - 1]?.id;
          const lastNewId = data[data.length - 1]?.id;
          if (prev.length === data.length && lastPrevId === lastNewId) {
            return prev; // no change — skip re-render
          }
          return data;
        });

        // Track if new messages arrived for auto-scroll decision
        const hasNewMessages = data.length > prevMessageCountRef.current;
        prevMessageCountRef.current = data.length;

        // Auto-scroll only on first load or when new messages arrive AND user is near bottom
        if (isFirstLoad || (hasNewMessages && isNearBottomRef.current)) {
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: isFirstLoad ? "auto" : "smooth" });
          });
        }

        isFirstLoad = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    }

    // Reset on thread change
    isFirstLoad = true;
    prevMessageCountRef.current = 0;
    isNearBottomRef.current = true;

    loadMessages();
    timer = setInterval(loadMessages, 8000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeThreadId, authRequired]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const identityName = auth?.name ?? auth?.owner_id ?? "You";
  const identityId = auth?.owner_id ?? "";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll is handled inside loadMessages above — no blind scroll on every render

  async function sendMessage() {
    if (!activeThreadId || !draft.trim()) return;
    const payload = {
      thread_id: activeThreadId,
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

  async function createThread() {
    if (!newThreadTitle.trim()) return;
    const payload = {
      title: newThreadTitle.trim(),
      thread_type: newThreadType,
    };

    try {
      setCreatingThread(true);
      const thread = await coordFetch<Thread>("/api/coord/threads", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setNewThreadTitle("");
      setNewThreadType("general");
      setShowCreateThread(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread");
    } finally {
      setCreatingThread(false);
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

  if (authRequired) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">Authentication required</p>
          <p className="text-[var(--muted)] text-sm">
            Please sign in to access coordination threads.
          </p>
          <div className="mt-4">
            <Button onClick={() => (window.location.href = "/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px,1fr] h-[calc(100vh-3rem)]">
      <aside className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-4 overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              Threads
            </p>
            <h2 className="text-lg font-semibold">Coordination</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="h-9 w-9 rounded-full px-0"
              onClick={() => setShowCreateThread((prev) => !prev)}
              title="New thread"
            >
              +
            </Button>
            <span className="text-xs text-[var(--muted)]">{threads.length}</span>
          </div>
        </div>

        {showCreateThread && (
          <div className="mb-4 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] p-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">
              New Thread
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Thread title"
                value={newThreadTitle}
                onChange={(event) => setNewThreadTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createThread();
                  }
                }}
              />
              <select
                value={newThreadType}
                onChange={(event) => setNewThreadType(event.target.value)}
                className={cn(
                  "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
                  "text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                )}
              >
                <option value="general">general</option>
                <option value="project">project</option>
                <option value="task">task</option>
              </select>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-[var(--card-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]"
                  onClick={() => {
                    setShowCreateThread(false);
                    setNewThreadTitle("");
                    setNewThreadType("general");
                  }}
                >
                  Cancel
                </button>
                <Button
                  onClick={createThread}
                  disabled={!newThreadTitle.trim() || creatingThread}
                >
                  {creatingThread ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loadingThreads ? (
          <p className="text-sm text-[var(--muted)]">Loading threads...</p>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => {
              const label = thread.title || "Untitled thread";
              const isActive = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={cn(
                    "w-full text-left rounded-2xl border px-3 py-3 transition",
                    isActive
                      ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--card-border)] bg-[var(--surface-2)] text-[var(--foreground)] hover:border-[var(--accent)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-2xl border text-[10px] font-semibold flex items-center justify-center",
                        isActive
                          ? "border-transparent bg-[var(--accent-strong)] text-[var(--accent-foreground)]"
                          : "border-[var(--card-border)] bg-[var(--surface)] text-[var(--muted)]"
                      )}
                    >
                      {initialsFor(label)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-snug">
                        {label}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {thread.thread_type} · {formatTime(thread.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <section className="flex flex-col rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden">
        <header className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--surface-2)]/80 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
              Live Coordination
            </p>
            <h2 className="text-xl font-semibold">
              {activeThread?.title ?? "Select a thread"}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="h-10 w-10 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-xs font-semibold">
              {initialsFor(identityName)}
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Signed in as</p>
              <p className="text-sm font-medium">{identityName}</p>
            </div>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {loadingMessages ? (
              <p className="text-sm text-[var(--muted)]">
                Loading messages...
              </p>
            ) : messages.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">
                No messages yet. Start the conversation.
              </div>
            ) : (
              messages.map((message) => {
                const sender = message.sender_id ?? "unknown";
                const isSelf = Boolean(
                  sender &&
                    (sender === identityId || sender === identityName)
                );
                const content =
                  messageText(message.payload) || "(no message content)";
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full gap-4",
                      isSelf ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isSelf && (
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--foreground)]">
                        {initialsFor(sender)}
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex max-w-[80%] flex-col gap-2",
                        isSelf ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                          isSelf
                            ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                            : "bg-[var(--card)] border-[var(--card-border)]"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-2 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.2em]",
                            isSelf
                              ? "text-[rgba(10,12,15,0.7)]"
                              : "text-[var(--muted)]"
                          )}
                        >
                          <span>{isSelf ? "You" : sender}</span>
                          <span>{formatTime(message.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{content}</p>
                      </div>
                    </div>
                    {isSelf && (
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-foreground)]">
                        {initialsFor(identityName)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-[var(--card-border)] bg-[var(--surface-2)]/80 px-6 py-4">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            <div className="flex items-end gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-3 py-3 shadow-sm">
              <Textarea
                rows={3}
                placeholder="Write a coordination update..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="border-none bg-transparent px-2 py-1 focus:ring-0"
              />
              <Button
                className="self-end"
                onClick={sendMessage}
                disabled={!draft.trim() || !activeThreadId}
              >
                Send
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Syncs every 8 seconds. Use for check-ins, blockers, and next
              steps.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
