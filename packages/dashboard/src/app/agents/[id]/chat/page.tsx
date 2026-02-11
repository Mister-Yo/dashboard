"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAgents, useSendMessage } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

interface CoordThread {
  id: string;
  threadType: string;
  isDirectMessage: boolean;
  participantIds: string[];
  title: string | null;
  createdAt: string;
}

function useDMThread(agentId: string | null) {
  return useQuery<CoordThread>({
    queryKey: ["dm-thread", agentId],
    queryFn: () => apiFetch(`/api/coord/dm/${agentId}`),
    enabled: !!agentId,
  });
}

function getUser() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("employee_info") : null;
    if (raw) return JSON.parse(raw) as { id: string; name: string; role: string };
  } catch {}
  return null;
}

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const { data: agents = [] } = useAgents();
  const agent = agents.find((a) => a.id === agentId);

  const { data: thread, isLoading: threadLoading } = useDMThread(agentId);
  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["coord-messages", thread?.id],
    queryFn: () => apiFetch(`/api/coord/messages?thread_id=${thread!.id}`),
    enabled: !!thread?.id,
    refetchInterval: 2000, // Poll every 2s for agent replies
  });
  const sendMessage = useSendMessage();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = getUser();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !thread) return;

    sendMessage.mutate({
      thread_id: thread.id,
      sender_id: user?.name ?? "CEO",
      message_type: "note",
      payload: { text: input.trim() },
    });

    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isLoading = threadLoading || messagesLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--card-border)] px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/agents")}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition text-lg"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-semibold">
            {agent?.name?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div>
            <h1 className="text-lg font-semibold">{agent?.name ?? "Agent"}</h1>
            <p className="text-xs text-[var(--muted)]">
              {agent?.type} · {agent?.status ?? "unknown"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoading && (
          <p className="text-center text-[var(--muted)] text-sm py-8">Loading conversation...</p>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-[var(--muted)] text-sm">
              No messages yet. Start a conversation with {agent?.name ?? "this agent"}.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === (user?.name ?? "CEO");
          const text = (msg.payload as any)?.text ?? JSON.stringify(msg.payload);

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
                  isMe
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-[var(--surface)] border border-[var(--card-border)]"
                }`}
              >
                {!isMe && (
                  <p className="text-[10px] font-medium text-[var(--muted)] mb-1">
                    {msg.senderId ?? "Unknown"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{text}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-white/50" : "text-[var(--muted)]"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--card-border)] px-6 py-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent?.name ?? "agent"}...`}
            className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <Button onClick={handleSend} disabled={!input.trim() || !thread || sendMessage.isPending}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
