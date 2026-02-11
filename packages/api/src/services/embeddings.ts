import { logger } from "../lib/logger";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";

// Voyage: 1024 default, supports 256/512/1024/2048
// OpenAI text-embedding-3-small: supports custom dimensions
const TARGET_DIMENSIONS = 1024;

/**
 * Generate embedding vector for text.
 * Tries Voyage AI first (VOYAGE_API_KEY), then OpenAI (OPENAI_API_KEY).
 * Returns null if no API key available — caller should fallback to text search.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const truncated = text.slice(0, 32000);

  // Try Voyage AI first (best quality for RAG)
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (voyageKey) {
    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${voyageKey}`,
        },
        body: JSON.stringify({
          model: "voyage-3",
          input: [truncated],
          output_dimension: TARGET_DIMENSIONS,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data: { embedding: number[] }[];
        };
        return data.data[0].embedding;
      }
      logger.warn({ status: response.status }, "Voyage AI embedding failed");
    } catch (err) {
      logger.error({ err }, "Voyage AI embedding error");
    }
  }

  // Fallback: OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: truncated,
          dimensions: TARGET_DIMENSIONS,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data: { embedding: number[] }[];
        };
        return data.data[0].embedding;
      }
      logger.warn({ status: response.status }, "OpenAI embedding failed");
    } catch (err) {
      logger.error({ err }, "OpenAI embedding error");
    }
  }

  return null;
}
