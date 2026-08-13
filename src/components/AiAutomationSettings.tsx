import { ArrowRight, BrainCircuit, Eye, EyeOff, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AiRepository,
  type AiProviderChannel,
  type AiSettings,
} from "../services/aiRepository";
import {
  AiModelPickerDialog,
  AiModelPickerTrigger,
  type AiModelOption,
} from "./AiModelPicker";

const CHANNEL_LABELS: Record<AiProviderChannel, string> = {
  openrouter: "OpenRouter",
  deepseek_direct: "DeepSeek 直连",
  qwen_direct: "千问直连",
};

const SAVED_API_KEY_MASK = "••••••••••••••••••••••••";

export function AiAutomationSettingsEntry({
  onOpen,
}: {
  onOpen: () => void;
}) {
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
          <span id="ai-settings-entry-description">管理主题洞察与主题管理使用的模型、接入通道和 API Key。</span>
        </span>
      </span>
      <span className="ai-automation-entry-cue" data-card-cue="forward" aria-hidden="true"><ArrowRight size={19} /></span>
    </button>
  );
}

function catalogIsStale(value: string | null): boolean {
  if (!value) return true;
  const refreshedAt = new Date(value).getTime();
  return Number.isNaN(refreshedAt) || Date.now() - refreshedAt > 24 * 60 * 60 * 1000;
}

export function AiAutomationSettings({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const repository = useMemo(() => new AiRepository(), []);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [channel, setChannel] = useState<AiProviderChannel>("openrouter");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [revealingApiKey, setRevealingApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoRefreshAttempted = useRef(false);

  const activeProvider = settings?.providers.find((item) => item.channel === channel) ?? null;
  const activeModel = activeProvider?.models.find((model) => model.id === modelId) ?? activeProvider?.models[0] ?? null;
  const modelOptions = useMemo<AiModelOption[]>(() => (activeProvider?.models ?? []).map((model) => ({
    channel,
    modelId: model.id,
    label: `${model.author} · ${model.name}`,
  })), [activeProvider?.models, channel]);
  const activeModelOption = activeModel ? modelOptions.find((option) => option.modelId === activeModel.id) ?? null : null;

  const applySettings = (next: AiSettings) => {
    setSettings(next);
    setChannel(next.activeChannel);
    const provider = next.providers.find((item) => item.channel === next.activeChannel);
    setModelId(provider?.selectedModelId ?? provider?.models[0]?.id ?? "");
    setApiKey(provider?.configured ? SAVED_API_KEY_MASK : "");
    setModelPickerOpen(false);
    setShowApiKey(false);
  };

  useEffect(() => {
    let cancelled = false;
    void repository.getSettings()
      .then(async (loaded) => {
        if (cancelled) return;
        applySettings(loaded);
        if (autoRefreshAttempted.current) return;
        autoRefreshAttempted.current = true;
        let refreshed = loaded;
        for (const provider of loaded.providers) {
          if (!provider.configured || !catalogIsStale(provider.catalogRefreshedAt)) continue;
          try {
            refreshed = await repository.refreshModels(provider.channel);
          } catch {
            // 自动刷新失败不阻断设置页，用户仍可使用上次成功保存的目录。
          }
        }
        if (!cancelled) applySettings(refreshed);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "AI 设置读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const chooseChannel = (next: AiProviderChannel) => {
    setChannel(next);
    const provider = settings?.providers.find((item) => item.channel === next);
    setModelId(provider?.selectedModelId ?? provider?.models[0]?.id ?? "");
    setApiKey(provider?.configured ? SAVED_API_KEY_MASK : "");
    setModelPickerOpen(false);
    setShowApiKey(false);
    setError("");
  };

  const toggleApiKeyVisibility = async () => {
    if (showApiKey) {
      setShowApiKey(false);
      return;
    }
    if (apiKey !== SAVED_API_KEY_MASK) {
      setShowApiKey(true);
      return;
    }
    setRevealingApiKey(true);
    setError("");
    try {
      setApiKey(await repository.revealApiKey(channel));
      setShowApiKey(true);
    } catch (revealError) {
      const message = revealError instanceof Error ? revealError.message : String(revealError);
      setError(`API Key 读取失败：${message}`);
    } finally {
      setRevealingApiKey(false);
    }
  };

  const save = async (refreshCatalog: boolean) => {
    setBusy(true);
    setError("");
    try {
      const saved = await repository.saveSettings({
        activeChannel: channel,
        selectedModelId: modelId || null,
        apiKey: apiKey === SAVED_API_KEY_MASK ? undefined : apiKey.trim() || undefined,
      });
      applySettings(saved);
      if (!refreshCatalog) {
        onNotify("AI 模型选择已保存");
        return;
      }
      try {
        const refreshed = await repository.refreshModels(channel);
        applySettings(refreshed);
        onNotify("AI 通道已连接，模型目录已更新");
      } catch (refreshError) {
        const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
        setError(`设置已保存，但模型目录更新失败：${message}`);
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`AI 设置保存失败：${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ai-settings-panel" aria-label="AI 自动整理设置">
      <p className="ai-settings-intro">用于主题洞察与主题管理建议。OpenAI 和 Claude 模型统一通过 OpenRouter 使用；千问直连使用阿里云百炼 API Key。</p>

      <div className="ai-channel-switch" role="radiogroup" aria-label="选择 AI 接入通道">
        {(Object.keys(CHANNEL_LABELS) as AiProviderChannel[]).map((item) => (
          <button
            type="button"
            role="radio"
            aria-checked={channel === item}
            className={channel === item ? "selected" : ""}
            key={item}
            onClick={() => chooseChannel(item)}
          >
            {CHANNEL_LABELS[item]}
            {settings?.providers.find((provider) => provider.channel === item)?.configured
              ? <small>已配置</small>
              : null}
          </button>
        ))}
      </div>

      <div className="ai-settings-fields">
        <label>
          <span>API Key</span>
          <div className="ai-api-key-control">
            <input
              type={showApiKey ? "text" : "password"}
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onFocus={(event) => {
                if (apiKey === SAVED_API_KEY_MASK) event.currentTarget.select();
              }}
              onBlur={() => {
                if (!apiKey && activeProvider?.configured) setApiKey(SAVED_API_KEY_MASK);
              }}
              placeholder="粘贴 API Key"
            />
            <button
              type="button"
              aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              disabled={revealingApiKey || (!apiKey && !activeProvider?.configured)}
              onClick={() => void toggleApiKeyVisibility()}
            >
              {showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        <div className="ai-model-field">
          <span>任务路由基准</span>
          <AiModelPickerTrigger option={activeModelOption} onClick={() => setModelPickerOpen(true)} />
        </div>
      </div>

      <p className="ai-settings-route-note">
        <strong>任务路由：</strong>{channel === "qwen_direct"
          ? "逐篇整理与批量归属固定用 Qwen3.7 Flash；跨文档主题结构与主题整合固定用 Qwen3.7 Plus；主题洞察默认用 Plus，只有明确选择 Qwen3.8 Max（预览）才启用高难判断档。"
          : channel === "deepseek_direct"
            ? "逐篇整理与批量归属固定用 DeepSeek V4 Flash；跨文档主题结构、主题整合与主题洞察固定用 DeepSeek V4 Pro。"
            : "所选模型只确定 OpenRouter 的模型家族：系统优先在同一供应商内用 Flash / Mini / Haiku 等轻量档完成逐篇整理，用 Terra / Sonnet / Pro 等均衡档完成跨文档任务；只有明确选择 Sol / Opus / Max 等高难档时，主题洞察才使用该档。目录缺少对应档位时保守沿用当前模型，绝不跨供应商自动替换。"}
      </p>

      {error ? <p className="ai-settings-error">{error}</p> : null}

      <div className="ai-settings-footer">
        <div>
          <span>{settings?.usage.taskCount ?? 0} 个任务</span>
          <span>{(settings?.usage.totalTokens ?? 0).toLocaleString("zh-CN")} tokens</span>
          <span>
            缓存读取 {(settings?.usage.cachedTokens ?? 0).toLocaleString("zh-CN")}
            （{settings?.usage.promptTokens
              ? ((settings.usage.cachedTokens / settings.usage.promptTokens) * 100).toFixed(1)
              : "0.0"}%）
          </span>
          <span>
            {settings?.usage.knownCacheSavingsRecordCount
              ? `已知缓存净节省 $${settings.usage.knownCacheSavingsUsd.toFixed(4)}`
              : "缓存节省暂不可核算"}
            {settings?.usage.unknownCacheSavingsRecordCount
              ? `（另有 ${settings.usage.unknownCacheSavingsRecordCount} 项价格未知）`
              : ""}
          </span>
          <span>
            {settings?.usage.knownCostTaskCount
              ? `已知成本 $${settings.usage.knownCostUsd.toFixed(4)}`
              : "成本暂不可核算"}
            {settings?.usage.unknownCostTaskCount
              ? `（${settings.usage.unknownCostTaskCount} 个任务价格未知）`
              : ""}
          </span>
        </div>
        <button type="button" disabled={busy} onClick={() => void save(false)}>
          <Save size={15} />保存选择
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void save(true)}>
          <RefreshCw size={15} className={busy ? "spinning" : ""} />
          {busy ? "正在连接…" : "保存并更新模型"}
        </button>
      </div>
      {modelPickerOpen ? <AiModelPickerDialog
        options={modelOptions}
        selection={modelId ? { channel, modelId } : null}
        onSelect={(selection) => setModelId(selection.modelId)}
        onClose={() => setModelPickerOpen(false)}
      /> : null}
    </section>
  );
}
