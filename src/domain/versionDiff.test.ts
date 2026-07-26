import { describe, expect, it } from "vitest";
import { versionDifferences } from "./versionDiff";
import { BrowserRecordRepository } from "../services/recordRepository";

describe("versionDifferences", () => {
  it("reports changed fields and omits identical fields", async () => {
    const repository = new BrowserRecordRepository({ empty: true, persist: false });
    const record = await repository.createRecord({
      title: "版本差异",
      currentJudgment: "第一版",
      tags: ["A"],
    });
    const previous = structuredClone(record);
    const current = { ...record, currentJudgment: "第二版", tags: ["A", "B"] };
    expect(versionDifferences(current, previous).map((item) => item.label))
      .toEqual(["标签", "当前判断"]);
  });
});
