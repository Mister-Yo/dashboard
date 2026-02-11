"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  useCoordThreads,
  useCoordMessages,
  useCreateThread,
  useSendMessage,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FadeIn } from "@/components/ui/fade-in";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

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

function messageText(payload: Record<string, unknown> | string | null) {
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

function CoordinationSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[300px,1fr] h-[calc(100vh-3rem)]">
      <aside className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-4 space-y-4">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-3"
          >
            <Skeleton className="h-9 w-9 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </aside>
      <section className="flex flex-col rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--surface-2)]/80 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex w-full gap-4", i % 2 === 0 ? "justify-start" : "justify-end")}>
                {i % 2 === 0 && <Skeleton className="h-10 w-10 rounded-full shrink-0 mt-1" />}
                <div className={cn("flex max-w-[80%] flex-col gap-2", i % 2 === 0 ? "items-start" : "items-end")}>
                  <Skeleton className={cn("h-20 rounded-2xl", i % 2 === 0 ? "w-64" : "w-48")} />
                </div>
                {i % 2 !== 0 && <Skeleton className="h-10 w-10 rounded-full shrink-0 mt-1" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CoordinationPage() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadType, setNewThreadType] = useState("general");

  const { data: allThreads = [], isLoading: loadingThreads } = useCoordThreads();
  // Hide DM threads — those are accessed via Agent Chat
  const threads = useMemo(() => allThreads.filter((t) => !t.isDirectMessage), [allThreads]);
  const { data: messages = [], isLoading: loadingMessages } = useCoordMessages(activeThreadId);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();

  // Auto-select first thread
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const identityName = "CEO";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(0);

  // Track scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    function handleScroll() {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: prevCountRef.current === 0 ? "auto" : "smooth" });
      });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  async function handleSend() {
    if (!activeThreadId || !draft.trim()) return;
    sendMessage.mutate({
      thread_id: activeThreadId,
      message_type: "note",
      payload: { text: draft.trim() },
    });
    setDraft("");
  }

  async function handleCreateThread() {
    if (!newThreadTitle.trim()) return;
    createThread.mutate(
      {
        title: newThreadTitle.trim(),
        thread_type: newThreadType,
      },
      {
        onSuccess: (thread) => {
          setActiveThreadId(thread.id);
          setNewThreadTitle("");
          setNewThreadType("general");
          setShowCreateThread(false);
        },
      }
    );
  }

  if (loadingThreads) {
    return (
      <FadeIn>
        <PageHeader
          label="Live Coordination"
          title="Coordination"
          description="Real-time threads for check-ins, blockers, and next steps"
        />
        <CoordinationSkeleton />
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <PageHeader
        label="Live Coordination"
        title="Coordination"
        description="Real-time threads for check-ins, blockers, and next steps"
        stats={[
          { label: "threads", value: threads.length, color: "primary" as const },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[300px,1fr] h-[calc(100vh-3rem)]">
        <aside className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-4 overflow-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                Threads
              </p>
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
                      handleCreateThread();
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
                    onClick={handleCreateThread}
                    disabled={!newThreadTitle.trim() || createThread.isPending}
                  >
                    {createThread.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                        {thread.threadType} · {formatTime(thread.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
              {loadingMessages ? (
                <div className="flex flex-col gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={cn("flex w-full gap-4", i % 2 === 0 ? "justify-start" : "justify-end")}>
                      {i % 2 === 0 && <Skeleton className="h-10 w-10 rounded-full shrink-0 mt-1" />}
                      <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-64" : "w-48")} />
                      {i % 2 !== 0 && <Skeleton className="h-10 w-10 rounded-full shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                messages.map((message, index) => {
                  const sender = message.senderId ?? "unknown";
                  const isSelf = sender === identityName || sender === "CEO";
                  const content =
                    messageText(message.payload as Record<string, unknown> | string | null) || "(no message content)";

                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const prevSender = prevMessage?.senderId ?? null;
                  const isContinuation = prevSender === sender;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex w-full gap-4",
                        isSelf ? "justify-end" : "justify-start",
                        isContinuation ? "mt-1" : "mt-5"
                      )}
                    >
                      {!isSelf && (
                        isContinuation ? (
                          <div className="w-10 shrink-0" />
                        ) : (
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--foreground)]">
                            {initialsFor(sender)}
                          </div>
                        )
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
                          {!isContinuation && (
                            <div
                              className={cn(
                                "mb-2 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.2em]",
                                isSelf
                                  ? "text-[rgba(10,12,15,0.7)]"
                                  : "text-[var(--muted)]"
                              )}
                            >
                              <span>{isSelf ? "You" : sender}</span>
                              <span>{formatTime(message.createdAt)}</span>
                            </div>
                          )}
                          {isContinuation && (
                            <div
                              className={cn(
                                "mb-1 flex justify-end text-[10px] uppercase tracking-[0.2em]",
                                isSelf
                                  ? "text-[rgba(10,12,15,0.7)]"
                                  : "text-[var(--muted)]"
                              )}
                            >
                              <span>{formatTime(message.createdAt)}</span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{content}</p>
                        </div>
                      </div>
                      {isSelf && (
                        isContinuation ? (
                          <div className="w-10 shrink-0" />
                        ) : (
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-foreground)]">
                            {initialsFor(identityName)}
                          </div>
                        )
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  className="self-end"
                  onClick={handleSend}
                  disabled={!draft.trim() || !activeThreadId || sendMessage.isPending}
                >
                  {sendMessage.isPending ? "..." : "Send"}
                </Button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Real-time coordination via Hono API (/api/coord/). Enter to send, Shift+Enter for new line.
              </p>
            </div>
          </div>
        </section>
      </div>
    </FadeIn>
  );
}
