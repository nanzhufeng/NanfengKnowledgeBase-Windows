import { Check, ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

import type { AiModelSelection } from "../services/aiRepository";

export type AiModelOption = {
  channel: AiModelSelection["channel"];
  modelId: string;
  label: string;
  configured: boolean;
};

export type AiModelPresentation = {
  provider: string;
  tone: "openai" | "anthropic" | "deepseek" | "qwen" | "default";
  capability: string;
};

function routeSourceLabel(channel: AiModelSelection["channel"]): string {
  switch (channel) {
    case "qwen_direct": return "千问直连";
    case "deepseek_direct": return "DeepSeek 直连";
    case "openrouter": return "OpenRouter";
  }
}

function displayModelName(option: AiModelOption, presentation: AiModelPresentation): string {
  const rawName = option.label.split(" · ").slice(1).join(" · ") || option.modelId;
  return rawName.replace(new RegExp(`^${presentation.provider}\\s*[:·-]\\s*`, "i"), "");
}

export function presentAiModel(option: AiModelOption): AiModelPresentation {
  const [author = "", ...nameParts] = option.label.split(" · ");
  const name = nameParts.join(" · ") || option.modelId;
  const source = `${author} ${name} ${option.modelId}`.toLowerCase();
  const normalizedAuthor = author.toLowerCase();
  const provider = normalizedAuthor === "openai" ? "OpenAI"
    : normalizedAuthor === "anthropic" ? "Anthropic"
      : normalizedAuthor === "deepseek" ? "DeepSeek"
        : normalizedAuthor === "qwen" || normalizedAuthor === "alibaba" ? "Qwen"
          : author || "其他模型";
  const tone = normalizedAuthor === "openai" ? "openai"
    : normalizedAuthor === "anthropic" ? "anthropic"
      : normalizedAuthor === "deepseek" ? "deepseek"
        : normalizedAuthor === "qwen" || normalizedAuthor === "alibaba" ? "qwen"
          : "default";
  const capability = /qwen3\.7-flash/.test(source)
    ? "逐篇档案、批量归属：速度与成本优先"
    : /qwen3\.7-plus/.test(source)
      ? "主题结构、主题整合、常规主题洞察"
      : /qwen3\.8-max/.test(source)
        ? "复杂争议与高难判断：仅手动选择"
        : /deepseek-v4-flash/.test(source)
          ? "高频整理备用：千问不可用时使用"
          : /deepseek-v4-pro/.test(source)
            ? "跨文档整合与复杂主题洞察：成本较高"
            : normalizedAuthor === "anthropic"
              ? "长文本整合、证据边界与判断演变"
              : normalizedAuthor === "openai"
                ? "复杂主题洞察与决策分析"
                : /flash|mini|haiku|fast|lite/.test(source)
                  ? "逐篇整理与批量归属：速度优先"
                  : /pro|max|opus|reasoner|r1|o[1-9]/.test(source)
                    ? "复杂主题洞察与高难判断"
                    : "主题整合与日常分析";
  return { provider, tone, capability };
}

export function AiModelPickerTrigger({
  option,
  automatic = false,
  label = "选择 AI 模型",
  onClick,
}: {
  option: AiModelOption | null;
  automatic?: boolean;
  label?: string;
  onClick: () => void;
}) {
  const presentation = option ? presentAiModel(option) : null;
  const modelName = option && presentation ? displayModelName(option, presentation) : option?.modelId;
  return (
    <button
      type="button"
      className="ai-model-picker-trigger"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {automatic ? <>
        <span className="ai-model-picker-bar qwen" aria-hidden="true" />
        <span><strong>自动规划</strong><small>千问 → DeepSeek → OpenRouter；任务开始时冻结</small></span>
      </> : presentation && option ? <>
        <span className={`ai-model-picker-bar ${presentation.tone}`} aria-hidden="true" />
        <span><strong>{routeSourceLabel(option.channel)} · {presentation.provider} · {modelName}</strong><small>{presentation.capability}</small></span>
      </> : <span className="ai-model-picker-empty">连接后自动获取最新模型</span>}
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

export function AiModelPickerDialog({
  options,
  selection,
  automaticSelected,
  onSelectAutomatic,
  onSelect,
  onClose,
}: {
  options: AiModelOption[];
  selection: AiModelSelection | null;
  automaticSelected: boolean;
  onSelectAutomatic: () => void;
  onSelect: (selection: AiModelSelection) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape, true);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="ai-model-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ai-model-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="选择 AI 模型"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><span>任务路由基准</span><h2>选择模型</h2><p>自动规划优先使用已配置的千问；手动选择会覆盖自动规划。</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="ai-model-picker-options" role="listbox" aria-label="AI 模型列表">
          <button
            type="button"
            role="option"
            aria-selected={automaticSelected}
            className={`ai-model-option qwen${automaticSelected ? " selected" : ""}`}
            onClick={() => {
              onSelectAutomatic();
              onClose();
            }}
          >
            <span className="ai-model-option-bar" aria-hidden="true" />
            <span><strong>自动规划</strong><small>高频任务用 Flash，跨文档任务用 Plus；千问未配置时依次降级。</small></span>
            {automaticSelected ? <Check size={17} aria-label="当前选择" /> : null}
          </button>
          {options.map((option) => {
            const presentation = presentAiModel(option);
            const selected = selection?.channel === option.channel && selection.modelId === option.modelId;
            const modelName = displayModelName(option, presentation);
            return <button
              key={`${option.channel}:${option.modelId}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={`ai-model-option ${presentation.tone}${selected ? " selected" : ""}`}
              disabled={!option.configured}
              onClick={() => {
                onSelect({ channel: option.channel, modelId: option.modelId });
                onClose();
              }}
            >
              <span className="ai-model-option-bar" aria-hidden="true" />
              <span><strong>{routeSourceLabel(option.channel)} · {presentation.provider} · {modelName}</strong><small>{option.configured ? presentation.capability : `请先配置 ${routeSourceLabel(option.channel)} API Key`}</small></span>
              {selected ? <Check size={17} aria-label="当前选择" /> : null}
            </button>;
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
