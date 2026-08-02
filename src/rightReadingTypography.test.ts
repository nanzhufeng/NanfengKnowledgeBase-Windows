/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const knowledgeReader = readFileSync(
  new URL("./components/KnowledgeReadingWorkspace.tsx", import.meta.url),
  "utf8",
);
const knowledgeWorkspace = readFileSync(
  new URL("./components/KnowledgeWorkspace.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const markdownContent = readFileSync(
  new URL("./components/MarkdownContent.tsx", import.meta.url),
  "utf8",
);

describe("右侧主体阅读字号合同", () => {
  it("对知识、来源和记录右侧阅读区把原1.3倍字号统一缩小到0.9", () => {
    expect(styles).toContain("--right-reading-scale: 1.17");
    expect(styles).toContain("--right-reading-13: 15.21px");
    expect(styles).toContain("--right-reading-12: 14.04px");
    expect(styles).toContain("--right-reading-11: 12.87px");
    expect(styles).toContain("--right-reading-10: 11.7px");
    expect(styles).toContain("--right-reading-9: 10.53px");
    expect(styles).toContain(":is(.knowledge-final-reader, .knowledge-inbox-detail, .detail-panel)");
  });

  it("正文放大时显式保留各阅读上下文原有链接字号", () => {
    expect(styles).toContain(
      ".knowledge-final-reader .knowledge-final-hypothesis-thesis > .markdown-content a",
    );
    expect(styles).toContain(
      ".knowledge-final-reader .knowledge-final-version-diff .markdown-content a",
    );
    expect(styles).toContain(
      ":is(.source-final-body, .detail-panel) .source-message.compact .markdown-content a",
    );
    expect(styles).toMatch(
      /source-message\.compact \.markdown-content a\s*\{\s*font-size:\s*12px;/,
    );
  });

  it("六类右侧正文由真实消费者显式接入语义字号，而不是只在 CSS 声明选择器", () => {
    expect(knowledgeReader).toContain(
      'className="right-reading-copy right-reading-copy-13"',
    );
    expect(knowledgeReader).toContain(
      'className="right-reading-copy right-reading-copy-11"',
    );
    expect(knowledgeReader).toContain(
      'className="right-reading-copy right-reading-copy-10"',
    );
    expect(knowledgeWorkspace).toContain(
      'className={compact ? "right-reading-copy right-reading-copy-12" : undefined}',
    );
    expect(knowledgeWorkspace).toContain(
      'className="source-plain-text right-reading-copy right-reading-copy-12"',
    );
    expect(app).toContain(
      'className={compact ? "right-reading-copy right-reading-copy-12" : undefined}',
    );
    expect(app).toContain(
      'className="right-reading-copy right-reading-copy-12"',
    );
    expect(app).toContain(
      'className="source-preview-markdown right-reading-copy right-reading-copy-12"',
    );
    expect(markdownContent).toContain("className = \"\"");
    expect(markdownContent).toContain("${className}`.trim()");
  });

  it("Markdown 正文、表格和标题跟随主体字号，正文链接仍按原层级保护", () => {
    expect(styles).toContain(
      ".right-reading-copy :is(p, li, blockquote, th, td)",
    );
    expect(styles).toMatch(
      /\.right-reading-copy h1\s*\{\s*font-size:\s*26\.91px;/,
    );
    expect(styles).toMatch(
      /\.right-reading-copy h4\s*\{\s*font-size:\s*15\.21px;/,
    );
    expect(styles).toMatch(
      /\.right-reading-copy-12 :is\(p, li, blockquote, th, td\) a\s*\{\s*font-size:\s*12px;/,
    );
  });
});
