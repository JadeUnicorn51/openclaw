import { describe, expect, it } from "vitest";
import { chunkMemoryContent } from "./chunk-factory.js";
import { MemoryWholeDocumentLimitError } from "./chunk-strategies.js";

describe("memory chunk factory", () => {
  it("keeps tokens as the default strategy", () => {
    const content = "line 1\nline 2\nline 3";
    const chunks = chunkMemoryContent(content, {
      tokens: 400,
      overlap: 0,
    });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toContain("line 1");
  });

  it("splits by paragraphs when strategy is paragraphs", () => {
    const content = "p1-a\np1-b\n\np2-a\np2-b";
    const chunks = chunkMemoryContent(content, {
      strategy: "paragraphs",
      tokens: 400,
      overlap: 0,
    });
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[0]?.endLine).toBe(2);
    expect(chunks[1]?.startLine).toBe(4);
    expect(chunks[1]?.endLine).toBe(5);
  });

  it("splits by markdown sections when strategy is section", () => {
    const content = "# Intro\nintro text\n## Detail\ndetail text";
    const chunks = chunkMemoryContent(content, {
      strategy: "section",
      tokens: 400,
      overlap: 0,
    });
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBe(3);
  });

  it("stores a single chunk for whole_doc under size limit", () => {
    const content = "short contract text";
    const chunks = chunkMemoryContent(content, {
      strategy: "whole_doc",
      tokens: 400,
      overlap: 0,
      wholeDocMaxChars: 64,
    });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe(content);
  });

  it("throws for whole_doc when size exceeds limit", () => {
    expect(() =>
      chunkMemoryContent("x".repeat(200), {
        strategy: "whole_doc",
        tokens: 400,
        overlap: 0,
        wholeDocMaxChars: 100,
      }),
    ).toThrowError(MemoryWholeDocumentLimitError);
  });
});
