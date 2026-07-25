import { describe, expect, it } from "vitest";

import { BrowserRecordRepository, RepositoryError } from "./recordRepository";

describe("BrowserRecordRepository contract", () => {
  it("keeps create, edit, search, versions and trash on one record model", async () => {
    const repository = new BrowserRecordRepository({ persist: false, empty: true });
    const created = await repository.createRecord({
      title: "AI资本开支与自由现金流",
      summary: "研究摘要",
      status: "tracking",
      tags: ["资本开支", "云计算"],
      currentJudgment: "初始判断",
      sourceText: "谷歌与微软均提高资本开支",
    });

    expect(created.versionCount).toBe(1);
    expect(await repository.listRecords({ search: "资本开支" })).toHaveLength(1);
    expect(await repository.listRecords({ search: "谷歌" })).toHaveLength(1);

    const updated = await repository.updateRecord(created.id, {
      title: created.title,
      summary: created.summary,
      status: "updated",
      tags: created.tags,
      currentJudgment: "更新后的判断",
      confirmedFacts: created.confirmedFacts,
      keyEvidence: created.keyEvidence,
      openQuestions: created.openQuestions,
      nextActions: created.nextActions,
      notes: created.notes,
      sourceText: created.sourceText,
      sources: [],
    });
    const version = await repository.appendVersion(updated.id, "判断更新", "补充证据");
    expect(version.versionNumber).toBe(2);

    await repository.updateRecord(created.id, {
      ...updated,
      currentJudgment: "第三次判断",
      sources: [],
    });
    const restored = await repository.restoreVersion(created.id, version.id);
    expect(restored.versionNumber).toBe(3);
    expect((await repository.getRecord(created.id)).currentJudgment).toBe("更新后的判断");

    await repository.moveToTrash(created.id);
    expect(await repository.listRecords()).toHaveLength(0);
    expect(await repository.listRecords({ deletedOnly: true })).toHaveLength(1);
    await repository.restoreRecord(created.id);
    expect(await repository.listRecords()).toHaveLength(1);
  });

  it("requires trash state and exact title for permanent deletion", async () => {
    const repository = new BrowserRecordRepository({ persist: false, empty: true });
    const created = await repository.createRecord({ title: "需要确认删除" });

    await expect(repository.permanentlyDeleteRecord(created.id, created.title))
      .rejects.toMatchObject({ code: "conflict" } satisfies Partial<RepositoryError>);
    await repository.moveToTrash(created.id);
    await expect(repository.permanentlyDeleteRecord(created.id, "错误标题"))
      .rejects.toMatchObject({ code: "validation_error" } satisfies Partial<RepositoryError>);

    await repository.permanentlyDeleteRecord(created.id, created.title);
    await expect(repository.getRecord(created.id))
      .rejects.toMatchObject({ code: "not_found" } satisfies Partial<RepositoryError>);
  });
});
