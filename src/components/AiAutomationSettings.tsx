import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, CircleAlert, Eye, EyeOff, ListChecks, LoaderCircle, PauseCircle, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  AiRepository,
  type AiCallHistoryEntry,
  type AiModelSelection,
  type AiProviderChannel,
  type AiSettings,
} from "../services/aiRepository";
import {
  AiModelPickerDialog,
  AiModelPickerTrigger,
  type AiModelOption,
} from "./AiModelPicker";

const PROVIDER_LABELS: Record<AiProviderChannel, string> = {
  openrouter: "OpenRouter",
  deepseek_direct: "DeepSeek 直连",
  qwen_direct: "千问直连",
};

const STAGE_LABELS: Record<string, string> = {
  profiles: "全库分类 · 语义档案",
  structure: "全库分类 · 主题结构",
  assignments: "全库分类 · 笔记归属",
  integrations: "全库分类 · 主题整合",
};

function callOperationLabel(entry: AiCallHistoryEntry): string {
  if (entry.stage && STAGE_LABELS[entry.stage]) return STAGE_LABELS[entry.stage];
  if (entry.taskKind === "topic_insight") return "主题洞察";
  if (entry.taskKind === "taxonomy_incremental") return "增量全库分类";
  if (entry.taskKind === "taxonomy_revision") return "全库分类";
  return "AI 自动整理";
}

function callStatusPresentation(status: AiCallHistoryEntry["status"]) {
  switch (status) {
    case "succeeded": return { label: "成功", icon: CheckCircle2 };
    case "failed": return { label: "调用失败", icon: CircleAlert };
    case "interrupted": return { label: "已中断", icon: PauseCircle };
    default: return { label: "进行中", icon: LoaderCircle };
  }
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function AiAutomationSettingsEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="settings-action-section ai-automation-entry"
      data-card-interaction="lift"
      onClick={onOpen}
      aria-labelledby="ai-settings-entry-title"
      aria-describedby="ai-settings-entry-description"
      title="打开 AI 自动整理设置"
    >
      <span className="ai-automation-entry-copy">
        <span className="settings-icon"><BrainCircuit size={21} /></span>
        <span className="ai-automation-entry-text">
          <strong id="ai-settings-entry-title">AI 自动整理</strong>
          <span id="ai-settings-entry-description">任务路由、模型与 API Key</span>
        </span>
      </span>
      <span className="ai-automation-entry-cue" data-card-cue="forward" aria-hidden="true"><ArrowRight size={19} /></span>
    </button>
  );
}

export function AiAutomationSettings({ onNotify }: { onNotify: (message: string) => void }) {
  const repository = useMemo(() => new AiRepository(), []);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [routingMode, setRoutingMode] = useState<"auto" | "manual">("auto");
  const [manualSelection, setManualSelection] = useState<AiModelSelection | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AiProviderChannel, string>>({ openrouter: "", deepseek_direct: "", qwen_direct: "" });
  const [shownKeys, setShownKeys] = useState<Record<AiProviderChannel, boolean>>({ openrouter: false, deepseek_direct: false, qwen_direct: false });
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [busyRoute, setBusyRoute] = useState(false);
  const [busyProvider, setBusyProvider] = useState<AiProviderChannel | null>(null);
  const [view, setView] = useState<"settings" | "history">("settings");
  const [history, setHistory] = useState<AiCallHistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  const applySettings = (next: AiSettings) => {
    setSettings(next);
    setRoutingMode(next.routingMode);
    setManualSelection(next.manualSelection);
  };

  useEffect(() => {
    let cancelled = false;
    void repository.getSettings().then((loaded) => {
      if (!cancelled) applySettings(loaded);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "AI 设置读取失败");
    });
    return () => { cancelled = true; };
  }, [repository]);

  const modelOptions = useMemo<AiModelOption[]>(() => (settings?.providers ?? []).flatMap((provider) => provider.models.map((model) => ({
    channel: provider.channel,
    modelId: model.id,
    label: `${model.author} · ${model.name}`,
    configured: provider.configured,
  }))), [settings]);
  const selectedOption = manualSelection
    ? modelOptions.find((option) => option.channel === manualSelection.channel && option.modelId === manualSelection.modelId) ?? null
    : null;

  const saveRoute = async () => {
    setBusyRoute(true);
    setError("");
    try {
      const saved = await repository.saveSettings({
        routingMode,
        manualSelection: routingMode === "manual" ? manualSelection : null,
      });
      applySettings(saved);
      onNotify(routingMode === "auto" ? "已启用自动任务路由" : "已保存手动任务路由");
    } catch (saveError) {
      setError(saveError instanceof Error ? `任务路由保存失败：${saveError.message}` : "任务路由保存失败");
    } finally {
      setBusyRoute(false);
    }
  };

  const toggleApiKeyVisibility = async (channel: AiProviderChannel) => {
    if (shownKeys[channel]) {
      setShownKeys((current) => ({ ...current, [channel]: false }));
      return;
    }
    const configured = settings?.providers.find((provider) => provider.channel === channel)?.configured;
    if (!apiKeys[channel] && configured) {
      try {
        const key = await repository.revealApiKey(channel);
        setApiKeys((current) => ({ ...current, [channel]: key }));
      } catch (revealError) {
        setError(revealError instanceof Error ? `API Key 读取失败：${revealError.message}` : "API Key 读取失败");
        return;
      }
    }
    setShownKeys((current) => ({ ...current, [channel]: true }));
  };

  const saveProviderKey = async (channel: AiProviderChannel) => {
    const key = apiKeys[channel].trim();
    if (!key) {
      setError(`请填写 ${PROVIDER_LABELS[channel]} API Key`);
      return;
    }
    setBusyProvider(channel);
    setError("");
    try {
      const refreshed = await repository.refreshModels(channel, key);
      applySettings(refreshed);
      setShownKeys((current) => ({ ...current, [channel]: false }));
      setApiKeys((current) => ({ ...current, [channel]: "" }));
      onNotify(`${PROVIDER_LABELS[channel]} 已保存，模型目录已更新`);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? `${PROVIDER_LABELS[channel]} 更新失败：${refreshError.message}` : `${PROVIDER_LABELS[channel]} 更新失败`);
    } finally {
      setBusyProvider(null);
    }
  };

  const openHistory = async () => {
    setView("history");
    setHistory(null);
    setError("");
    try {
      setHistory(await repository.listCallHistory());
    } catch (historyLoadError) {
      setError(historyLoadError instanceof Error ? historyLoadError.message : "请稍后重试");
    }
  };

  if (view === "history") return <AiCallHistory entries={history} error={error} onReturn={() => { setView("settings"); setError(""); }} />;

  return (
    <section className="ai-settings-panel" aria-label="AI 自动整理设置">
      <div className="ai-routing-field">
        <span>任务路由基准</span>
        <AiModelPickerTrigger
          option={selectedOption}
          automatic={routingMode === "auto"}
          label="选择任务路由基准"
          onClick={() => setModelPickerOpen(true)}
        />
        {routingMode === "auto" && settings?.routePreview ? <small>当前：{PROVIDER_LABELS[settings.routePreview.providerChannel]} · 档案 {settings.routePreview.profileModelId} / 整合 {settings.routePreview.synthesisModelId}</small> : null}
      </div>

      <div className="ai-provider-key-grid" aria-label="AI API Key">
        {(Object.keys(PROVIDER_LABELS) as AiProviderChannel[]).map((channel) => {
          const provider = settings?.providers.find((item) => item.channel === channel);
          const saving = busyProvider === channel;
          return <section className="ai-provider-key-card" key={channel} aria-label={`${PROVIDER_LABELS[channel]} API Key`}>
            <span><strong>{PROVIDER_LABELS[channel]}</strong><small>{provider?.configured ? "已配置" : "未配置"}</small></span>
            <div className="ai-api-key-control">
              <input
                type={shownKeys[channel] ? "text" : "password"}
                aria-label={`${PROVIDER_LABELS[channel]} API Key`}
                autoComplete="off"
                value={apiKeys[channel]}
                onChange={(event) => setApiKeys((current) => ({ ...current, [channel]: event.target.value }))}
                placeholder={provider?.configured ? "" : "粘贴 API Key"}
              />
              {provider?.configured && !apiKeys[channel] && !shownKeys[channel] ? <span className="ai-api-key-saved-mask" aria-hidden="true">••••••••••••••••</span> : null}
              <button type="button" aria-label={shownKeys[channel] ? "隐藏 API Key" : "显示 API Key"} onClick={() => void toggleApiKeyVisibility(channel)}>
                {shownKeys[channel] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="button" disabled={saving} onClick={() => void saveProviderKey(channel)}>
              <RefreshCw size={14} className={saving ? "spinning" : ""} />{saving ? "正在更新…" : "保存并更新"}
            </button>
          </section>;
        })}
      </div>

      {error ? <p className="ai-settings-error">{error}</p> : null}

      <div className="ai-settings-footer">
        <div>
          <span>{settings?.usage.taskCount ?? 0} 个任务</span>
          <span>{(settings?.usage.totalTokens ?? 0).toLocaleString("zh-CN")} tokens</span>
          <span>缓存 {settings?.usage.promptTokens ? ((settings.usage.cachedTokens / settings.usage.promptTokens) * 100).toFixed(1) : "0.0"}%</span>
          <span>{settings?.usage.knownCostTaskCount ? `已知成本 $${settings.usage.knownCostUsd.toFixed(4)}` : "成本以账单为准"}</span>
        </div>
        <button type="button" disabled={busyRoute} onClick={() => void openHistory()}><ListChecks size={15} />调用记录</button>
        <button type="button" className="primary" disabled={busyRoute} onClick={() => void saveRoute()}><Save size={15} />保存路由</button>
      </div>

      {modelPickerOpen ? <AiModelPickerDialog
        options={modelOptions}
        selection={manualSelection}
        automaticSelected={routingMode === "auto"}
        onSelectAutomatic={() => { setRoutingMode("auto"); setManualSelection(null); }}
        onSelect={(selection) => { setRoutingMode("manual"); setManualSelection(selection); }}
        onClose={() => setModelPickerOpen(false)}
      /> : null}
    </section>
  );
}

function AiCallHistory({ entries, error, onReturn }: { entries: AiCallHistoryEntry[] | null; error: string; onReturn: () => void }) {
  return (
    <section className="ai-call-history-panel" aria-label="AI 调用记录">
      <header className="ai-call-history-header"><div><h3>调用记录</h3><p>最近 50 条</p></div><button type="button" onClick={onReturn}><ArrowLeft size={16} />返回设置</button></header>
      {error ? <p className="ai-settings-error">调用记录读取失败：{error}</p> : null}
      {!entries && !error ? <p className="ai-call-history-loading"><LoaderCircle size={16} className="spinning" />正在读取调用记录…</p> : null}
      {entries?.length === 0 ? <p className="ai-call-history-empty">暂无调用记录</p> : null}
      {entries?.length ? <ol className="ai-call-history-list">{entries.map((entry) => {
        const status = callStatusPresentation(entry.status);
        const StatusIcon = status.icon;
        const usage = [`输入 ${entry.promptTokens.toLocaleString("zh-CN")}`, `输出 ${entry.completionTokens.toLocaleString("zh-CN")}`, entry.cachedTokens > 0 ? `缓存 ${entry.cachedTokens.toLocaleString("zh-CN")}` : null, entry.reasoningTokens > 0 ? `推理 ${entry.reasoningTokens.toLocaleString("zh-CN")}` : null].filter(Boolean).join(" · ");
        return <li className={`ai-call-history-item ${entry.status}`} key={`${entry.taskPublicId}-${entry.stage ?? "summary"}-${entry.occurredAt}`}>
          <div className="ai-call-history-item-topline"><strong><StatusIcon size={16} />{status.label}</strong><time dateTime={entry.occurredAt}>{formatOccurredAt(entry.occurredAt)}</time></div>
          <p className="ai-call-history-model">{PROVIDER_LABELS[entry.providerChannel]} · {entry.modelId}</p><p>{callOperationLabel(entry)} · {usage} tokens</p>{entry.errorMessage ? <p className="ai-call-history-error">{entry.errorMessage}</p> : null}
        </li>;
      })}</ol> : null}
    </section>
  );
}
