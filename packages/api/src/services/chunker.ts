export interface Chunk {
  text: string;
  index: number;
}

const DEFAULT_CHUNK_SIZE = 1500; // ~375 tokens
const DEFAULT_OVERLAP = 200;

/**
 * Split text into overlapping chunks, breaking at paragraph > sentence > word boundaries.
 */
export function chunkText(
  text: string,
  maxChunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): Chunk[] {
  if (text.length <= maxChunkSize) {
    return [{ text, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;

    // Try to break at natural boundaries
    if (end < text.length) {
      const slice = text.slice(start, end);
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = slice.lastIndexOf(". ");
      const wordBreak = slice.lastIndexOf(" ");

      if (paraBreak > maxChunkSize * 0.5) {
        end = start + paraBreak + 2;
      } else if (sentenceBreak > maxChunkSize * 0.5) {
        end = start + sentenceBreak + 2;
      } else if (wordBreak > 0) {
        end = start + wordBreak + 1;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      chunks.push({ text: chunkText, index });
      index++;
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}
