/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const agents = readProjectFile("AGENTS.md");
const masterSpec = readProjectFile("docs/南枫知识库_产品定义与自动分类主规格.md");
const architecture = readProjectFile("docs/architecture-governance.md");
const designBaseline = readProjectFile("docs/core-workspace-design-baseline.md");
const acceptance = readProjectFile("docs/core-workspace-acceptance-matrix.md");
const nextPrompt = readProjectFile("docs/next-codex-prompt.md");
const appShell = readProjectFile("src/App.tsx");
const knowledgeWorkspace = readProjectFile("src/components/KnowledgeWorkspace.tsx");
const unifiedNoteList = readProjectFile("src/components/UnifiedNoteListCard.tsx");

describe("当前合同治理", () => {
  it("用户可见入口、内部兼容标识与历史证据边界明确", () => {
    for (const contract of [agents, masterSpec, architecture, designBaseline, acceptance, nextPrompt]) {
      expect(contract).toContain("主题洞察");
      expect(contract).toContain("全部笔记");
      expect(contract).toContain("主题管理");
    }
    expect(masterSpec).toContain("现行合同说明（2026-08-03）");
    expect(architecture).toContain("当前合同判定顺序");
    expect(designBaseline).toContain("只用于证据定位");
    expect(nextPrompt).toContain("当前已提交基线：`62e6a66`");
  });

  it("旧阶段和旧视觉规则不能重新取得当前所有权", () => {
    expect(agents).not.toContain("闭合连续描边");
    expect(agents).toContain("禁止连续等亮白线、闭环白描边和统一渐变描边");
    expect(masterSpec).toContain("历史阶段：第一阶段 UI 原型（已完成，不再作为当前入口）");
    expect(masterSpec).not.toContain("第一阶段只用假数据，不接数据库。");
    expect(acceptance).not.toContain("最新入口为`启动南枫知识库-苹果玻璃亮度重构验收.bat`");
    expect(acceptance).not.toContain("| 待执行 |");
  });

  it("历史资料范围在搜索浮层内可见且桌面右键由应用接管", () => {
    expect(appShell).toContain("历史资料搜索");
    expect(appShell).toContain("UnifiedHistoricalSearchScope");
    expect(knowledgeWorkspace).toContain("UnifiedHistoricalSearchScope");
    expect(knowledgeWorkspace).toContain("searchSourceAttachmentCatalog(query, sourceSearchCategory)");
    expect(knowledgeWorkspace).toContain("groupSourceAttachmentsByMonth(hits)");
    expect(knowledgeWorkspace).toContain("AttachmentTimelineDialog");
    expect(knowledgeWorkspace).toContain("markSourceTextMatches");
    expect(knowledgeWorkspace).toContain("已跳转到正文匹配位置，并以黄色标记");
    expect(unifiedNoteList).toContain("搜索范围");
    expect(unifiedNoteList).toContain('{ value: "video", label: "视频" }');
    expect(appShell).toContain('document.addEventListener("contextmenu", openContextMenu)');
    expect(appShell).toContain("[data-note-context-menu='true']");
    expect(appShell).toContain("input, textarea, select");
    expect(appShell).toContain("video, audio, iframe, a[href]");
    expect(appShell).toContain("currentSourceContextRef");
    expect(appShell).toContain("搜索当前笔记标题");
    expect(appShell).toContain("导出当前笔记");
    expect(knowledgeWorkspace).toContain("onCurrentSourceContextChange");
    expect(knowledgeWorkspace).toContain("ensureSourceActionTarget(selected)");
    expect(appShell).not.toContain("网页捕获");
  });
});
