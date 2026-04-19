import crypto from "node:crypto";
import { CHARS_PER_TOKEN_ESTIMATE, estimateStringChars } from "../../utils/cjk-chars.js";
import { buildTextEmbeddingInput } from "./embedding-inputs.js";
import { chunkMarkdown, type MemoryChunk } from "./internal.js";

export type MemoryChunkingStrategy = "tokens" | "paragraphs" | "section" | "whole_doc";

export class MemoryWholeDocumentLimitError extends Error {
  readonly code = "MEMORY_WHOLE_DOC_LIMIT_EXCEEDED";
  readonly estimatedChars: number;
  readonly maxChars: number;

  constructor(estimatedChars: number, maxChars: number) {
    super(
      `whole_doc strategy rejected input with estimated size ${estimatedChars} chars (limit ${maxChars})`,
    );
    this.name = "MemoryWholeDocumentLimitError";
    this.estimatedChars = estimatedChars;
    this.maxChars = maxChars;
  }
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createChunk(startLine: number, endLine: number, text: string): MemoryChunk {
  return {
    startLine,
    endLine,
    text,
    hash: hashText(text),
    embeddingInput: buildTextEmbeddingInput(text),
  };
}

function remapChunkLines(chunks: MemoryChunk[], startLineOffset: number): MemoryChunk[] {
  return chunks.map((chunk) =>
    createChunk(
      startLineOffset + chunk.startLine - 1,
      startLineOffset + chunk.endLine - 1,
      chunk.text,
    ),
  );
}

export function chunkByParagraphs(
  content: string,
  chunking: { tokens: number; overlap: number },
): MemoryChunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) {
    return [];
  }
  const maxChars = Math.max(32, chunking.tokens * CHARS_PER_TOKEN_ESTIMATE);
  const chunks: MemoryChunk[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    while (cursor < lines.length && (lines[cursor] ?? "").trim().length === 0) {
      cursor += 1;
    }
    if (cursor >= lines.length) {
      break;
    }
    const startLine = cursor + 1;
    let end = cursor;
    while (end + 1 < lines.length && (lines[end + 1] ?? "").trim().length > 0) {
      end += 1;
    }
    const text = lines.slice(cursor, end + 1).join("\n");
    if (estimateStringChars(text) > maxChars) {
      const split = chunkMarkdown(text, chunking);
      chunks.push(...remapChunkLines(split, startLine));
    } else {
      chunks.push(createChunk(startLine, end + 1, text));
    }
    cursor = end + 1;
  }
  return chunks;
}

function isSectionHeaderLine(line: string): boolean {
  const heading = /^\s{0,3}#{1,6}\s+\S/.test(line);
  if (heading) {
    return true;
  }
  return /^\s*(?:Section|Chapter)\s+\d+(?:\.\d+)*\b/i.test(line);
}

export function chunkBySections(
  content: string,
  chunking: { tokens: number; overlap: number },
): MemoryChunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) {
    return [];
  }
  const sectionStarts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isSectionHeaderLine(lines[i] ?? "")) {
      sectionStarts.push(i + 1);
    }
  }
  if (sectionStarts.length === 0) {
    return chunkByParagraphs(content, chunking);
  }
  if (sectionStarts[0] !== 1) {
    sectionStarts.unshift(1);
  }
  const maxChars = Math.max(32, chunking.tokens * CHARS_PER_TOKEN_ESTIMATE);
  const chunks: MemoryChunk[] = [];
  for (let i = 0; i < sectionStarts.length; i += 1) {
    const startLine = sectionStarts[i]!;
    const nextStart = sectionStarts[i + 1];
    const endLine = nextStart ? nextStart - 1 : lines.length;
    const text = lines.slice(startLine - 1, endLine).join("\n");
    if (estimateStringChars(text) > maxChars) {
      const split = chunkMarkdown(text, chunking);
      chunks.push(...remapChunkLines(split, startLine));
    } else {
      chunks.push(createChunk(startLine, endLine, text));
    }
  }
  return chunks;
}

export function chunkWholeDocument(
  content: string,
  maxChars: number,
): MemoryChunk[] {
  const safeMaxChars = Math.max(1, Math.floor(maxChars));
  const estimatedChars = estimateStringChars(content);
  if (estimatedChars > safeMaxChars) {
    throw new MemoryWholeDocumentLimitError(estimatedChars, safeMaxChars);
  }
  const lines = content.split("\n");
  return [createChunk(1, Math.max(1, lines.length), content)];
}
