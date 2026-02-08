"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type KnowledgeSource = "telegram" | "twitter" | "manual" | "agent" | "email";

interface KnowledgeEntry {
  id: string;
  title: string;
  url: string | null;
  content: string;
  summary: string;
  tags: string[];
  source: KnowledgeSource;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

const SOURCE_OPTIONS: KnowledgeSource[] = [
  "manual",
  "telegram",
  "twitter",
  "agent",
  "email",
];

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function selectClassName() {
  return cn(
    "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
    "text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  );
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<KnowledgeSource>("manual");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<KnowledgeSource | "all">(
    "all"
  );

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<KnowledgeEntry[]>("/api/knowledge");
        data.sort(
          (x, y) =>
            new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
        );
        setEntries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load knowledge");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filterSource !== "all" && entry.source !== filterSource) {
        return false;
      }
      if (q) {
        const haystack = `${entry.title}\n${entry.summary}\n${entry.content}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, filterSource]);

  const summaryCounts = useMemo(() => {
    const total = entries.length;
    const bySource = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.source] = (acc[entry.source] ?? 0) + 1;
      return acc;
    }, {});
    return { total, bySource };
  }, [entries]);

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await apiFetch<KnowledgeEntry>("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({
          title,
          url: url || null,
          content,
          summary,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          source,
        }),
      });
      setEntries((prev) => [created, ...prev]);
      setTitle("");
      setUrl("");
      setSource("manual");
      setSummary("");
      setContent("");
      setTags("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading knowledge base...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to connect to API</p>
          <p className="text-[var(--muted)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Knowledge
          </p>
          <h1 className="text-3xl font-semibold">Knowledge Base</h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">
            Collect articles, notes, and signals from Telegram, Obsidian, and the
            web.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summaryCounts.total} entries
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summaryCounts.bySource.manual ?? 0} manual
          </span>
          <span className="rounded-full border border-[var(--card-border)] px-3 py-1">
            {summaryCounts.bySource.telegram ?? 0} telegram
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Create
            </p>
            <h2 className="text-lg font-semibold">New Entry</h2>
          </div>
          <Button
            onClick={handleCreate}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? "Creating..." : "Create entry"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <select
            className={selectClassName()}
            value={source}
            onChange={(event) => setSource(event.target.value as KnowledgeSource)}
          >
            {SOURCE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <div className="md:col-span-2">
            <Input
              placeholder="URL (optional)"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              rows={2}
              placeholder="Summary (optional)"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              rows={6}
              placeholder="Content (markdown or plain text)"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              placeholder="Tags (comma separated)"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>
        </div>

        {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              List
            </p>
            <h2 className="text-lg font-semibold">Entries</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 w-full sm:w-auto">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={selectClassName()}
              value={filterSource}
              onChange={(event) =>
                setFilterSource(event.target.value as KnowledgeSource | "all")
              }
            >
              <option value="all">All sources</option>
              {SOURCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {entry.source}
                  </p>
                  <h3 className="text-lg font-semibold leading-tight">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {formatTime(entry.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
                  {entry.tags?.length ?? 0} tags
                </span>
              </div>

              {entry.url && (
                <a
                  className="mt-3 block text-sm text-[var(--primary)] underline-offset-4 hover:underline break-all"
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {entry.url}
                </a>
              )}

              {entry.summary && (
                <p className="text-sm text-[var(--muted)] mt-3 line-clamp-4 whitespace-pre-wrap">
                  {entry.summary}
                </p>
              )}

              {!entry.summary && (
                <p className="text-sm text-[var(--muted)] mt-3 line-clamp-4 whitespace-pre-wrap">
                  {entry.content}
                </p>
              )}

              {entry.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.tags.slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-[var(--muted)]">
              No knowledge entries found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
