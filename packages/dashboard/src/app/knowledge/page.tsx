"use client";

import { useMemo, useState, useEffect } from "react";
import { useKnowledge, useCreateKnowledge, useKnowledgeSearch } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/ui/fade-in";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

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
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
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
    "text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
  );
}

export default function KnowledgePage() {
  const { data: rawEntries, isLoading, error, refetch } = useKnowledge();
  const createKnowledge = useCreateKnowledge();

  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<KnowledgeSource>("manual");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [smartSearch, setSmartSearch] = useState(false);
  const [filterSource, setFilterSource] = useState<KnowledgeSource | "all">(
    "all"
  );

  // Debounce search input for smart search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Hybrid search query
  const {
    data: searchResult,
    isLoading: searchLoading,
  } = useKnowledgeSearch(
    smartSearch ? debouncedSearch : "",
    "hybrid"
  );

  const entries = useMemo(
    () =>
      [...(rawEntries ?? [])].sort(
        (x, y) =>
          new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
      ) as KnowledgeEntry[],
    [rawEntries]
  );

  // Use search results when smart search is active, otherwise filter locally
  const filtered = useMemo(() => {
    if (smartSearch && debouncedSearch.trim().length >= 2 && searchResult?.results) {
      return searchResult.results as KnowledgeEntry[];
    }

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
  }, [entries, search, filterSource, smartSearch, debouncedSearch, searchResult]);

  const summaryCounts = useMemo(() => {
    const total = entries.length;
    const bySource = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.source] = (acc[entry.source] ?? 0) + 1;
      return acc;
    }, {});
    return { total, bySource };
  }, [entries]);

  async function handleCreate() {
    setFormError(null);
    try {
      await createKnowledge.mutateAsync({
        title,
        url: url || null,
        content,
        summary,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source,
      });
      setTitle("");
      setUrl("");
      setSource("manual");
      setSummary("");
      setContent("");
      setTags("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create entry");
    }
  }

  if (isLoading) {
    return (
      <FadeIn>
        <PageHeader label="Knowledge" title="Knowledge Base" />
        <SkeletonGrid count={6} />
      </FadeIn>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to connect to API"
        detail={error instanceof Error ? error.message : "Failed to load knowledge"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <FadeIn>
      <div className="space-y-8">
        <PageHeader
          label="Knowledge"
          title="Knowledge Base"
          description="Collect articles, notes, and signals from Telegram, Obsidian, and the web."
          stats={[
            { label: "entries", value: summaryCounts.total, color: "primary" as const },
            { label: "manual", value: summaryCounts.bySource.manual ?? 0, color: "muted" as const },
            { label: "telegram", value: summaryCounts.bySource.telegram ?? 0, color: "muted" as const },
          ]}
        />

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
              disabled={createKnowledge.isPending || !title.trim() || !content.trim()}
            >
              {createKnowledge.isPending ? "Creating..." : "Create entry"}
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
            <div className="grid gap-2 sm:grid-cols-3 w-full sm:w-auto">
              <Input
                placeholder={smartSearch ? "AI-powered search..." : "Search..."}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className={selectClassName()}
                value={filterSource}
                onChange={(event) =>
                  setFilterSource(event.target.value as KnowledgeSource | "all")
                }
                disabled={smartSearch}
              >
                <option value="all">All sources</option>
                {SOURCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSmartSearch(!smartSearch)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
                  smartSearch
                    ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
                    : "border-[var(--card-border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                )}
              >
                {smartSearch ? "\u2726 Smart" : "\u2726 Smart"}
              </button>
            </div>
          </div>

          {/* Search meta info */}
          {smartSearch && searchResult && debouncedSearch.trim().length >= 2 && (
            <div className="flex items-center gap-2 mb-4 text-xs text-[var(--muted)]">
              <span className={cn(
                "rounded-full px-2.5 py-0.5 font-medium border",
                searchResult.method === "hybrid"
                  ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                  : searchResult.method === "semantic"
                  ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                  : "border-amber-500/30 text-amber-400 bg-amber-500/10"
              )}>
                {searchResult.method}
              </span>
              <span>{filtered.length} results</span>
              {searchResult.meta && (
                <>
                  <span>&middot;</span>
                  <span>{searchResult.meta.keywordHits} keyword</span>
                  <span>&middot;</span>
                  <span>{searchResult.meta.semanticHits} semantic</span>
                </>
              )}
              {searchLoading && <span className="animate-pulse">searching...</span>}
            </div>
          )}

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
                        onClick={() => { setSearch(tag); setSmartSearch(false); setFilterSource("all"); }}
                        className="cursor-pointer rounded-full border border-[var(--card-border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon="📚"
                  title={smartSearch && searchLoading ? "Searching..." : "No knowledge entries found"}
                  description="Try adjusting your search or create a new entry."
                  compact
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </FadeIn>
  );
}
