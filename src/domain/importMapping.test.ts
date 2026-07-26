import { describe, expect, it } from "vitest";
import { mapImportedRecord } from "./importMapping";

describe("importMapping", () => {
  it("maps arbitrary source fields without losing the original object", () => {
    const record = mapImportedRecord(
      {
        headline: "自定义标题",
        labels: "资本开支，云计算",
        conclusion: "映射后的判断",
      },
      undefined,
      {
        title: "headline",
        tags: "labels",
        currentJudgment: "conclusion",
      },
      0,
    );
    expect(record.title).toBe("自定义标题");
    expect(record.tags).toEqual(["资本开支", "云计算"]);
    expect(record.currentJudgment).toBe("映射后的判断");
    expect(record.sourceText).toContain("headline");
  });
});
