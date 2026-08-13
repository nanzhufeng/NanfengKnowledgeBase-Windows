import { Check, ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

import type { AiModelSelection } from "../services/aiRepository";

export type AiModelOption = {
  channel: AiModelSelection["channel"];
  modelId: string;
  label: string;
};

export type AiModelPresentation = {
  provider: string;
  tone: "openai" | "anthropic" | "deepseek" | "qwen" | "default";
  capability: string;
};

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
  const capability = /flash|mini|haiku|fast|lite/.test(source)
    ? "快速档 · 更低延迟"
    : /pro|max|opus|reasoner|r1|o[1-9]/.test(source)
      ? "高能力档 · 复杂分析"
      : "均衡档 · 日常整理与分析";
  return { provider, tone, capability };
}

export function AiModelPickerTrigger({
  option,
  label = "选择 AI 模型",
  onClick,
}: {
  option: AiModelOption | null;
  label?: string;
  onClick: () => void;
}) {
  const presentation = option ? presentAiModel(option) : null;
  const modelName = option?.label.split(" · ").slice(1).join(" · ") || option?.modelId;
  return (
    <button
      type="button"
      className="ai-model-picker-trigger"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {presentation && option ? <>
        <span className={`ai-model-picker-bar ${presentation.tone}`} aria-hidden="true" />
        <span><strong>{presentation.provider} · {modelName}</strong><small>{presentation.capability}</small></span>
      </> : <span className="ai-model-picker-empty">连接后自动获取最新模型</span>}
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

export function AiModelPickerDialog({
  options,
  selection,
  onSelect,
  onClose,
}: {
  options: AiModelOption[];
  selection: AiModelSelection | null;
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
          <div><span>模型服务</span><h2>选择 AI 模型</h2><p>按供应商与能力区分；选择后回到当前页面继续操作。</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        {options.length ? <div className="ai-model-picker-options" role="listbox" aria-label="AI 模型列表">
          {options.map((option) => {
            const presentation = presentAiModel(option);
            const selected = selection?.channel === option.channel && selection.modelId === option.modelId;
            const modelName = option.label.split(" · ").slice(1).join(" · ") || option.modelId;
            return <button
              key={`${option.channel}:${option.modelId}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={`ai-model-option ${presentation.tone}${selected ? " selected" : ""}`}
              onClick={() => {
                onSelect({ channel: option.channel, modelId: option.modelId });
                onClose();
              }}
            >
              <span className="ai-model-option-bar" aria-hidden="true" />
              <span><strong>{presentation.provider} · {modelName}</strong><small>{presentation.capability}</small></span>
              {selected ? <Check size={17} aria-label="当前选择" /> : null}
            </button>;
          })}
        </div> : <p className="ai-model-picker-empty">连接后自动获取最新模型</p>}
      </section>
    </div>,
    document.body,
  );
}
