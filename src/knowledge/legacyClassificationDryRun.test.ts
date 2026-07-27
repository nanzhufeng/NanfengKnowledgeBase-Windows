import { describe, expect, it } from "vitest";

import {
  buildLegacyClassificationDryRun,
  renderLegacyClassificationDryRunMarkdown,
  type LegacyClassificationInput,
} from "./legacyClassificationDryRun";

function input(): LegacyClassificationInput {
  return {
    reportVersion: 1,
    generatedAt: "2026-07-27T01:00:00+08:00",
    sourceDatabase: "C:\\audit\\legacy-readonly-copy.db",
    sourceDatabaseSha256Before: "ABC",
    sourceConnectionQueryOnly: true,
    sourceIntegrityCheck: "ok",
    sourceTotalChangesBefore: 0,
    recordCount: 1,
    records: [{
      recordId: 1,
      title: "AI 资本开支周期是否接近拐点",
      legacyTitle: "Untitled",
      titleResolutionStatus: "recovered",
      status: "normal",
      summary: "云厂商现金流与 GPU 交付",
      currentJudgment: "",
      confirmedFacts: [],
      keyEvidence: [],
      openQuestions: [],
      nextActions: [],
      notes: "",
      sourceText: JSON.stringify({
        chat_messages: [
          { sender: "human", text: "资本开支和自由现金流应该如何比较？" },
          { sender: "assistant", text: "需要区分训练集群与推理基础设施。" },
        ],
      }),
      tags: [],
      sources: [{
        sourceType: "import",
        title: "conversations.json",
        url: null,
        localPath: "imports/raw/conversations.json",
        externalId: null,
      }],
      originalAt: "2026-07-20T00:00:00+08:00",
      createdAt: "2026-07-27T00:00:00+08:00",
      updatedAt: "2026-07-27T00:00:00+08:00",
    }],
    sourceTotalChangesAfter: 0,
    sourceDatabaseSha256After: "ABC",
  };
}

describe("legacy classification dry run", () => {
  it("复用唯一分类器并在相同输入上保持确定性", () => {
    const first = buildLegacyClassificationDryRun(input());
    const second = buildLegacyClassificationDryRun(input());

    expect(first).toEqual(second);
    expect(first.records[0].topSuggestion.topicId).toBe("ai-capex-cycle");
    expect(first.records[0].sourceKind).toBe("ai_conversation");
    expect(first.classifier.catalogStatus).toBe("provisional");
    expect(first.source.totalChangesAfter).toBe(0);
  });

  it("拒绝缺少只读证据的输入并生成带限制说明的报告", () => {
    const unsafe = input();
    unsafe.sourceDatabaseSha256After = "CHANGED";
    expect(() => buildLegacyClassificationDryRun(unsafe)).toThrow("只读证据");

    const markdown = renderLegacyClassificationDryRunMarkdown(
      buildLegacyClassificationDryRun(input()),
    );
    expect(markdown).toContain("临时主题目录");
    expect(markdown).toContain("没有写入任何数据库");
    expect(markdown).toContain("AI 资本开支");
  });
});
