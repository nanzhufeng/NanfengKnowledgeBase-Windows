import type { KnowledgeTopicDetail } from "../services/knowledgeRepository";

export type SynthesizedKnowledgeAnchor = {
  id: string;
  sourceItemId: number;
  sourceTitle: string;
  quote: string;
  occurredAt: string;
  confidence: number;
  stance: "support" | "oppose";
};

export type SynthesizedHypothesis = {
  id: string;
  statement: string;
  rationale: string;
  confidence: number;
  invalidationCondition: string;
  anchors: SynthesizedKnowledgeAnchor[];
};

export type SynthesizedJudgment = {
  id: string;
  statement: string;
  confidence: number;
  effectiveAt: string;
  changeReason: string;
  sourceItemId: number;
  sourceTitle: string;
};

export type SynthesizedDecisionDraft = {
  id: string;
  title: string;
  decision: string;
  decidedAt: string;
  knownRisks: string[];
  expectedResult: string;
  actualActions: string[];
  finalResult: string;
  retrospective: string;
  sourceItemId: number;
  sourceTitle: string;
};

export type KnowledgeSynthesis = {
  hypotheses: SynthesizedHypothesis[];
  judgments: SynthesizedJudgment[];
  decisionDrafts: SynthesizedDecisionDraft[];
  openQuestions: string[];
};

export type KnowledgeOverviewItem = {
  id: string;
  text: string;
  sourceItemId: number | null;
  sourceTitle: string;
  locatorJson: string | null;
  locatorLabel: string | null;
  automatic: boolean;
};

export type KnowledgeOverview = {
  currentJudgment: {
    statement: string;
    confidence: number | null;
    effectiveAt: string;
    automatic: boolean;
  };
  facts: KnowledgeOverviewItem[];
  evidence: KnowledgeOverviewItem[];
  questions: KnowledgeOverviewItem[];
  actions: KnowledgeOverviewItem[];
};

type SemanticUnit = {
  id: string;
  text: string;
  sourceItemId: number;
  sourceTitle: string;
  occurredAt: string;
  confidence: number;
  index: number;
  score: number;
};

const CONCLUSION_SIGNAL = /(?:结论|判断|说明|表明|意味着|本质|核心|关键|原因|因此|所以|可行|不可行|更适合|优先|取决于|应当|应该|需要)/;
const ACTION_SIGNAL = /(?:建议|需要|应该|应当|优先|采用|选择|保持|避免|不要|先|再|下一步|可以直接|务必)/;
const RISK_SIGNAL = /(?:风险|问题|不足|失败|冲突|限制|不确定|不能|不应|不要|避免|缺少|可能导致)/;
const OPPOSITION_SIGNAL = /(?:但是|但|相反|并非|不是|不能|不应|不要|低于|失败|反例|冲突|否定)/;
const QUESTION_SIGNAL = /[?？]$|^(?:是否|为什么|为何|如何|能否|要不要|哪一种|什么条件)/;
const META_LINE = /^(?:用户|助手|系统|记录|metadata|model|create_time|update_time|conversation_id|source|tags?|aliases|created|updated)\s*[:：]?$/i;

function compactText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^[\s>#*_`~\-\d.)、•]+/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSemanticUnits(value: string): string[] {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/([。！？；])(?=[^\n])/g, "$1\n")
    .replace(/\n{2,}/g, "\n");
  const seen = new Set<string>();
  return normalized
    .split("\n")
    .map(compactText)
    .filter((line) => {
      const length = Array.from(line).length;
      if (length < 8 || length > 240 || META_LINE.test(line)) return false;
      if (/^[\d\s./:_-]+$/.test(line)) return false;
      const key = line.toLocaleLowerCase("zh-CN");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function tokenSet(value: string): Set<string> {
  const compact = value.toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
  const tokens = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    tokens.add(compact.slice(index, index + 2));
  }
  return tokens;
}

function similarity(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function unitScore(text: string, topicText: string): number {
  let score = Math.min(Array.from(text).length / 36, 4);
  if (CONCLUSION_SIGNAL.test(text)) score += 5;
  if (ACTION_SIGNAL.test(text)) score += 2;
  if (RISK_SIGNAL.test(text)) score += 1;
  if (similarity(text, topicText) > 0.12) score += 3;
  if (QUESTION_SIGNAL.test(text)) score -= 4;
  return score;
}

function sourceUnits(detail: KnowledgeTopicDetail): SemanticUnit[] {
  const topicText = `${detail.topic.name}${detail.topic.description}`;
  const units: SemanticUnit[] = [];
  detail.sources.forEach((source) => {
    splitSemanticUnits(source.contentText ?? "").forEach((text, index) => {
      units.push({
        id: `source-${source.id}-${index}`,
        text,
        sourceItemId: source.id,
        sourceTitle: source.title,
        occurredAt: source.originalAt ?? source.importedAt ?? "",
        confidence: Math.max(45, Math.min(95, source.confidence ?? 65)),
        index,
        score: unitScore(text, topicText),
      });
    });
  });
  detail.notes.forEach((note) => {
    splitSemanticUnits(`${note.summary}\n${note.bodyMarkdown}`).forEach((text, index) => {
      const source = detail.sources.find((candidate) => note.sourceItemIds.includes(candidate.id));
      if (!source) return;
      units.push({
        id: `note-${note.id}-${index}`,
        text,
        sourceItemId: source.id,
        sourceTitle: source.title,
        occurredAt: note.updatedAt,
        confidence: Math.max(55, Math.min(95, source.confidence ?? 72)),
        index,
        score: unitScore(text, topicText) + 2,
      });
    });
  });
  return units;
}

function selectDiverse(units: SemanticUnit[], limit: number): SemanticUnit[] {
  const selected: SemanticUnit[] = [];
  for (const unit of [...units].sort((left, right) => right.score - left.score)) {
    if (selected.some((item) => similarity(item.text, unit.text) > 0.58)) continue;
    selected.push(unit);
    if (selected.length >= limit) break;
  }
  return selected;
}

function anchorsFor(
  hypothesis: SemanticUnit,
  units: SemanticUnit[],
): SynthesizedKnowledgeAnchor[] {
  const candidates = units
    .filter((unit) => unit.id !== hypothesis.id)
    .map((unit) => ({ unit, similarity: similarity(hypothesis.text, unit.text) }))
    .filter(({ unit, similarity: value }) => (
      value >= 0.08
      || unit.sourceItemId === hypothesis.sourceItemId
      || Math.abs(unit.index - hypothesis.index) <= 1
    ))
    .sort((left, right) => (
      right.similarity - left.similarity
      || right.unit.score - left.unit.score
    ))
    .slice(0, 5);
  const anchors = candidates.map(({ unit }) => ({
    id: unit.id,
    sourceItemId: unit.sourceItemId,
    sourceTitle: unit.sourceTitle,
    quote: unit.text,
    occurredAt: unit.occurredAt,
    confidence: unit.confidence,
    stance: OPPOSITION_SIGNAL.test(unit.text) !== OPPOSITION_SIGNAL.test(hypothesis.text)
      ? "oppose" as const
      : "support" as const,
  }));
  if (!anchors.some((anchor) => anchor.stance === "support")) {
    anchors.unshift({
      id: hypothesis.id,
      sourceItemId: hypothesis.sourceItemId,
      sourceTitle: hypothesis.sourceTitle,
      quote: hypothesis.text,
      occurredAt: hypothesis.occurredAt,
      confidence: hypothesis.confidence,
      stance: "support",
    });
  }
  return anchors;
}

function judgmentUnits(units: SemanticUnit[]): SemanticUnit[] {
  const bySource = new Map<number, SemanticUnit[]>();
  units.forEach((unit) => {
    const list = bySource.get(unit.sourceItemId) ?? [];
    list.push(unit);
    bySource.set(unit.sourceItemId, list);
  });
  return [...bySource.values()]
    .map((items) => [...items].sort((left, right) => right.score - left.score)[0])
    .filter((item): item is SemanticUnit => Boolean(item))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .slice(-4);
}

function conciseTitle(value: string): string {
  const withoutPrefix = value.replace(/^(?:建议|需要|应该|应当|优先|可以)\s*/, "");
  const characters = Array.from(withoutPrefix);
  return characters.length > 24 ? `${characters.slice(0, 24).join("")}…` : withoutPrefix;
}

export function buildKnowledgeSynthesis(detail: KnowledgeTopicDetail): KnowledgeSynthesis {
  const units = sourceUnits(detail);
  const hypothesisUnits = selectDiverse(
    units.filter((unit) => CONCLUSION_SIGNAL.test(unit.text) && !ACTION_SIGNAL.test(unit.text)),
    3,
  );
  const fallbackHypotheses = hypothesisUnits.length
    ? hypothesisUnits
    : selectDiverse(units.filter((unit) => !QUESTION_SIGNAL.test(unit.text)), 3);
  const hypotheses = fallbackHypotheses.map((unit) => {
    const anchors = anchorsFor(unit, units);
    const independentSources = new Set(anchors.map((anchor) => anchor.sourceItemId)).size;
    return {
      id: `hypothesis-${unit.id}`,
      statement: unit.text,
      rationale: `从《${unit.sourceTitle}》正文提炼，并与 ${anchors.length} 条正文片段交叉关联。`,
      confidence: Math.min(95, Math.round(unit.confidence + Math.max(0, independentSources - 1) * 4)),
      invalidationCondition: "出现与该解释直接冲突、且来自独立来源的可靠事实时重新评估。",
      anchors,
    };
  });

  const selectedJudgments = judgmentUnits(units);
  const judgments = selectedJudgments.map((unit, index) => {
    const previous = selectedJudgments[index - 1];
    return {
      id: `judgment-${unit.id}`,
      statement: unit.text,
      confidence: Math.round(unit.confidence),
      effectiveAt: unit.occurredAt,
      changeReason: previous
        ? `新增来源《${unit.sourceTitle}》带来了不同于上一阶段的正文判断。`
        : `首次从《${unit.sourceTitle}》正文形成主题判断。`,
      sourceItemId: unit.sourceItemId,
      sourceTitle: unit.sourceTitle,
    };
  });

  const risks = selectDiverse(units.filter((unit) => RISK_SIGNAL.test(unit.text)), 5);
  const actions = selectDiverse(units.filter((unit) => ACTION_SIGNAL.test(unit.text)), 3);
  const decisionDrafts = actions.map((unit) => {
    const relatedRisk = risks.find((risk) => (
      risk.sourceItemId === unit.sourceItemId || similarity(risk.text, unit.text) > 0.08
    ));
    const expected = units
      .filter((candidate) => candidate.id !== unit.id && !RISK_SIGNAL.test(candidate.text))
      .sort((left, right) => similarity(right.text, unit.text) - similarity(left.text, unit.text))[0];
    return {
      id: `decision-${unit.id}`,
      title: conciseTitle(unit.text),
      decision: unit.text,
      decidedAt: unit.occurredAt,
      knownRisks: relatedRisk ? [relatedRisk.text] : [],
      expectedResult: expected?.text ?? "执行后需要补充可观测结果并在复核时间点回写。",
      actualActions: [],
      finalResult: "",
      retrospective: "",
      sourceItemId: unit.sourceItemId,
      sourceTitle: unit.sourceTitle,
    };
  });

  const explicitQuestions = units
    .filter((unit) => QUESTION_SIGNAL.test(unit.text))
    .map((unit) => unit.text);
  const inferredQuestions = risks.map((unit) => `需要验证：${unit.text}`);
  const openQuestions = [...new Set([...explicitQuestions, ...inferredQuestions])].slice(0, 5);

  return { hypotheses, judgments, decisionDrafts, openQuestions };
}

function uniqueOverviewItems(items: KnowledgeOverviewItem[], limit = 3): KnowledgeOverviewItem[] {
  const selected: KnowledgeOverviewItem[] = [];
  for (const item of items) {
    if (!item.text.trim()) continue;
    if (selected.some((candidate) => similarity(candidate.text, item.text) > 0.66)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

/**
 * 统一生成知识视图首屏摘要。正式知识对象优先；缺失时只从真实正文确定性提炼，
 * 不写回数据库，也不把建议行动伪装成已经执行的结果。
 */
export function buildKnowledgeOverview(
  detail: KnowledgeTopicDetail,
  synthesis = buildKnowledgeSynthesis(detail),
): KnowledgeOverview {
  const persistedJudgment = detail.judgments.find((item) => item.state === "current")
    ?? [...detail.judgments].sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))[0];
  const synthesizedJudgment = [...synthesis.judgments]
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))[0];
  const fallbackStatement = detail.sources.length || detail.notes.length
    ? "现有材料尚不足以形成可靠判断，请先核对下方事实线索与来源证据。"
    : "当前主题尚无可用于自动提炼的笔记或来源正文。";

  const formalFacts: KnowledgeOverviewItem[] = detail.propositions
    .filter((item) => item.status === "supported")
    .map((item) => ({
      id: `fact-proposition-${item.id}`,
      text: item.statementMarkdown,
      sourceItemId: null,
      sourceTitle: "正式命题",
      locatorJson: null,
      locatorLabel: null,
      automatic: false,
    }));
  const verifiedFacts: KnowledgeOverviewItem[] = detail.evidence
    .filter((item) => item.stance === "support" && item.verificationStatus === "verified")
    .sort((left, right) => right.credibility - left.credibility)
    .map((item) => ({
      id: `fact-evidence-${item.id}`,
      text: item.contentMarkdown,
      sourceItemId: item.sourceItemId,
      sourceTitle: item.sourceTitle,
      locatorJson: item.locatorJson,
      locatorLabel: item.locatorLabel,
      automatic: false,
    }));
  const extractedFacts: KnowledgeOverviewItem[] = synthesis.hypotheses.map((hypothesis) => {
    const anchor = hypothesis.anchors.find((item) => item.stance === "support")
      ?? hypothesis.anchors[0];
    return {
      id: `fact-hypothesis-${hypothesis.id}`,
      text: hypothesis.statement,
      sourceItemId: anchor?.sourceItemId ?? null,
      sourceTitle: anchor?.sourceTitle ?? "正文提炼",
      locatorJson: anchor
        ? JSON.stringify({ kind: "text_quote", value: anchor.quote, quote: anchor.quote })
        : null,
      locatorLabel: anchor ? `正文片段：${anchor.quote.slice(0, 36)}` : null,
      automatic: true,
    };
  });

  const formalEvidence: KnowledgeOverviewItem[] = [...detail.evidence]
    .sort((left, right) => right.credibility - left.credibility)
    .map((item) => ({
      id: `evidence-${item.id}`,
      text: item.contentMarkdown,
      sourceItemId: item.sourceItemId,
      sourceTitle: item.sourceTitle,
      locatorJson: item.locatorJson,
      locatorLabel: item.locatorLabel,
      automatic: false,
    }));
  const extractedEvidence: KnowledgeOverviewItem[] = synthesis.hypotheses
    .flatMap((hypothesis) => hypothesis.anchors)
    .map((anchor) => ({
      id: `evidence-anchor-${anchor.id}`,
      text: anchor.quote,
      sourceItemId: anchor.sourceItemId,
      sourceTitle: anchor.sourceTitle,
      locatorJson: JSON.stringify({ kind: "text_quote", value: anchor.quote, quote: anchor.quote }),
      locatorLabel: `正文片段：${anchor.quote.slice(0, 36)}`,
      automatic: true,
    }));

  const formalQuestions: KnowledgeOverviewItem[] = detail.questions
    .filter((item) => item.status !== "resolved")
    .map((item) => ({
      id: `question-${item.id}`,
      text: item.question,
      sourceItemId: null,
      sourceTitle: "待验证问题",
      locatorJson: null,
      locatorLabel: null,
      automatic: false,
    }));
  const extractedQuestions: KnowledgeOverviewItem[] = synthesis.openQuestions.map((question, index) => ({
    id: `question-automatic-${index}`,
    text: question,
    sourceItemId: null,
    sourceTitle: "正文提炼",
    locatorJson: null,
    locatorLabel: null,
    automatic: true,
  }));

  const pendingDecisionActions: KnowledgeOverviewItem[] = detail.decisions
    .filter((item) => item.status === "active" && item.resultStatus !== "succeeded")
    .flatMap((item) => {
      const reviewAction = item.reviewAt
        ? [`${item.reviewAt.slice(0, 10)} 复核：${item.title}`]
        : [];
      const riskActions = item.knownRisks.slice(0, 2).map((risk) => `验证风险：${risk}`);
      return [...reviewAction, ...riskActions].map((text, index) => ({
        id: `action-decision-${item.id}-${index}`,
        text,
        sourceItemId: null,
        sourceTitle: "正式决策",
        locatorJson: null,
        locatorLabel: null,
        automatic: false,
      }));
    });
  const extractedActions: KnowledgeOverviewItem[] = synthesis.decisionDrafts.map((item) => ({
    id: `action-${item.id}`,
    text: item.decision,
    sourceItemId: item.sourceItemId,
    sourceTitle: item.sourceTitle,
    locatorJson: null,
    locatorLabel: null,
    automatic: true,
  }));
  const validationActions: KnowledgeOverviewItem[] = synthesis.hypotheses.map((item) => ({
    id: `action-validation-${item.id}`,
    text: `验证：${item.invalidationCondition}`,
    sourceItemId: item.anchors[0]?.sourceItemId ?? null,
    sourceTitle: item.anchors[0]?.sourceTitle ?? "正文提炼",
    locatorJson: null,
    locatorLabel: null,
    automatic: true,
  }));

  return {
    currentJudgment: persistedJudgment ? {
      statement: persistedJudgment.statementMarkdown,
      confidence: persistedJudgment.confidence,
      effectiveAt: persistedJudgment.effectiveAt,
      automatic: false,
    } : synthesizedJudgment ? {
      statement: synthesizedJudgment.statement,
      confidence: synthesizedJudgment.confidence,
      effectiveAt: synthesizedJudgment.effectiveAt,
      automatic: true,
    } : {
      statement: fallbackStatement,
      confidence: null,
      effectiveAt: "",
      automatic: true,
    },
    facts: uniqueOverviewItems([...formalFacts, ...verifiedFacts, ...extractedFacts]),
    evidence: uniqueOverviewItems([...formalEvidence, ...extractedEvidence]),
    questions: uniqueOverviewItems([...formalQuestions, ...extractedQuestions]),
    actions: uniqueOverviewItems([...pendingDecisionActions, ...extractedActions, ...validationActions]),
  };
}
