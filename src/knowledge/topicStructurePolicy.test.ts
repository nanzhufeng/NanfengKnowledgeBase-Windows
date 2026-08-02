import { describe, expect, it } from "vitest";
import {
  collectTopicStructuralAttentionIds,
  topicHierarchyHasUsefulContent,
} from "./topicStructurePolicy";

const completeTopic = {
  id: 1,
  description: "动画设计、运动语言和界面动效",
  status: "active",
  sourceCount: 0,
};

describe("collectTopicStructuralAttentionIds", () => {
  it("保留有完整结构但暂时没有来源的主题，不把它交给用户二次判断", () => {
    const attentionIds = collectTopicStructuralAttentionIds(
      [completeTopic],
      [{ topicId: 1 }],
      [],
    );

    expect(attentionIds.has(1)).toBe(false);
  });

  it("只把真实结构缺口和明确关系建议列为待处理", () => {
    const attentionIds = collectTopicStructuralAttentionIds(
      [
        completeTopic,
        { ...completeTopic, id: 2, description: "" },
        { ...completeTopic, id: 3, sourceCount: 12 },
      ],
      [{ topicId: 1 }, { topicId: 2 }, { topicId: 3 }],
      [{ fromTopicId: 3, toTopicId: 1 }],
    );

    expect([...attentionIds]).toEqual([1, 2, 3]);
  });

  it("忽略已经合并的历史主题", () => {
    const attentionIds = collectTopicStructuralAttentionIds(
      [{ ...completeTopic, status: "merged", description: "" }],
      [],
      [],
    );

    expect(attentionIds.size).toBe(0);
  });

  it("不把缺少技术分类规则列为用户待处理事项", () => {
    const attentionIds = collectTopicStructuralAttentionIds(
      [completeTopic],
      [{ topicId: 1 }],
      [],
    );

    expect(attentionIds.size).toBe(0);
  });
});

describe("topicHierarchyHasUsefulContent", () => {
  it("隐藏没有父子差异的顶层叶子主题", () => {
    expect(topicHierarchyHasUsefulContent(false, 0)).toBe(false);
  });

  it("存在真实父主题或子主题时保留层级信息", () => {
    expect(topicHierarchyHasUsefulContent(true, 0)).toBe(true);
    expect(topicHierarchyHasUsefulContent(false, 2)).toBe(true);
  });
});
