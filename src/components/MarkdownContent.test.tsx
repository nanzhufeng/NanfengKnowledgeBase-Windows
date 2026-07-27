import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarkdownContent, {
  calloutToneFromText,
  isSafeEmbeddedImageSource,
  prepareObsidianMarkdown,
} from "./MarkdownContent";

describe("MarkdownContent", () => {
  it("preserves Obsidian callout semantics instead of flattening every block to orange", () => {
    const markdown = [
      "> [!success] 行动推进",
      "> - 练车启动",
      "",
      "> [!warning] 八字观察",
      "> - 需要复核",
      "",
      "> [!danger] 风险",
      "> - 不可继续",
      "",
      "> [!note] 家庭关系",
      "> - 记录线索",
      "",
      "> 普通引用",
    ].join("\n");
    const html = renderToStaticMarkup(<MarkdownContent value={markdown} />);

    expect(html).toContain("markdown-callout-success");
    expect(html).toContain("markdown-callout-warning");
    expect(html).toContain("markdown-callout-danger");
    expect(html).toContain("markdown-callout-info");
    expect(html).toContain("markdown-quote");
    expect(html).not.toContain("[!success]");
  });

  it("supports common Obsidian aliases and removes leading frontmatter from reading view", () => {
    const prepared = prepareObsidianMarkdown(
      "---\ntitle: 测试\n---\n> [!check] 已完成\n> [!question] 待确认",
    );
    expect(prepared).not.toContain("title: 测试");
    expect(prepared).toContain("✅ 已完成");
    expect(prepared).toContain("❓ 待确认");
    expect(calloutToneFromText("✅ 已完成")).toBe("success");
    expect(calloutToneFromText("❝ 原话")).toBe("quote");
  });

  it("blocks remote tracking images while preserving local and embedded images", () => {
    expect(isSafeEmbeddedImageSource("https://tracker.example/pixel.png")).toBe(false);
    expect(isSafeEmbeddedImageSource("//tracker.example/pixel.png")).toBe(false);
    expect(isSafeEmbeddedImageSource("data:image/png;base64,AAAA")).toBe(true);
    expect(isSafeEmbeddedImageSource("./attachments/local.png")).toBe(true);

    const html = renderToStaticMarkup(
      <MarkdownContent value="![远程图](https://tracker.example/pixel.png)" />,
    );
    expect(html).toContain("远程图片已阻止自动加载");
    expect(html).not.toContain("<img");
  });
});
