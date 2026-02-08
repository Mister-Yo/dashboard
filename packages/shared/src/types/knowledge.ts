export type KnowledgeSource = "telegram" | "twitter" | "manual" | "agent" | "email";

export interface KnowledgeEntry {
  id: string;
  title: string;
  url: string | null;
  content: string;
  summary: string;
  tags: string[];
  source: KnowledgeSource;
  sourceMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeInput {
  title: string;
  url?: string;
  content: string;
  summary?: string;
  tags?: string[];
  source: KnowledgeSource;
  sourceMessageId?: string;
}
