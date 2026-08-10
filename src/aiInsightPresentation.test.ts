import { describe, expect, it } from "vitest";
import { splitAiSummaryMarkdown } from "./aiInsightPresentation";

describe("AI 主题总览信息层级", () => {
  it("把证据边界清单从总览中分离并保留后续结论", () => {
    const result = splitAiSummaryMarkdown(`## 核心判断
主题已形成明确判断。

## 证据边界
基于两条记录：
- legacy-record-12：来源甲
- legacy-record-18：来源乙

## 矛盾
不同来源对时间点存在分歧。`);

    expect(result.overviewMarkdown).toContain("主题已形成明确判断");
    expect(result.overviewMarkdown).toContain("不同来源对时间点存在分歧");
    expect(result.overviewMarkdown).not.toContain("legacy-record-12");
    expect(result.boundaryMarkdown).toContain("legacy-record-12");
    expect(result.sourceCount).toBe(2);
  });

  it("兼容旧结果中的粗体来源边界标题", () => {
    const result = splitAiSummaryMarkdown(`主题总览正文。

**来源边界：**

* source-3：来源甲
* source-4：来源乙`);

    expect(result.overviewMarkdown).toBe("主题总览正文。");
    expect(result.boundaryMarkdown).toContain("source-4");
    expect(result.sourceCount).toBe(2);
  });

  it("普通正文提到证据边界时不误拆分", () => {
    const result = splitAiSummaryMarkdown("当前证据边界仍需扩大，但已有材料足以支持阶段判断。");

    expect(result.overviewMarkdown).toContain("证据边界仍需扩大");
    expect(result.boundaryMarkdown).toBe("");
  });
});
