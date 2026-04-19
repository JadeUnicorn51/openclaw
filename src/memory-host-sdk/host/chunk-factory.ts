import type { MemoryChunk } from "./internal.js";
import { chunkMarkdown } from "./internal.js";
import {
  chunkByParagraphs,
  chunkBySections,
  chunkWholeDocument,
  type MemoryChunkingStrategy,
} from "./chunk-strategies.js";

export type MemoryChunkingConfig = {
  tokens: number;
  overlap: number;
  strategy?: MemoryChunkingStrategy;
  wholeDocMaxChars?: number;
};

const DEFAULT_CHUNKING_STRATEGY: MemoryChunkingStrategy = "tokens";
const DEFAULT_WHOLE_DOC_MAX_CHARS = 16_000;

export function resolveMemoryChunkingStrategy(
  strategy: MemoryChunkingStrategy | undefined,
): MemoryChunkingStrategy {
  return strategy ?? DEFAULT_CHUNKING_STRATEGY;
}

export function resolveWholeDocMaxChars(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WHOLE_DOC_MAX_CHARS;
  }
  return Math.max(1, Math.floor(value!));
}

export function chunkMemoryContent(content: string, chunking: MemoryChunkingConfig): MemoryChunk[] {
  const strategy = resolveMemoryChunkingStrategy(chunking.strategy);
  if (strategy === "paragraphs") {
    return chunkByParagraphs(content, chunking);
  }
  if (strategy === "section") {
    return chunkBySections(content, chunking);
  }
  if (strategy === "whole_doc") {
    return chunkWholeDocument(content, resolveWholeDocMaxChars(chunking.wholeDocMaxChars));
  }
  return chunkMarkdown(content, chunking);
}
