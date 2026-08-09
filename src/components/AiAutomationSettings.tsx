import { BrainCircuit, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AiRepository,
  type AiProviderChannel,
  type AiSettings,
} from "../services/aiRepository";

const CHANNEL_LABELS: Record<AiProviderChannel, string> = {
  openrouter: "OpenRouter",
  deepseek_direct: "DeepSeek 直连",
};

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoRefreshAttempted = useRef(false);

  const activeProvider = settings?.providers.find((item) => item.channel === channel) ?? null;

  const applySettings = (next: AiSettings) => {
    setSettings(next);
    setChannel(next.activeChannel);
    const provider = next.providers.find((item) => item.channel === next.activeChannel);
    setModelId(provider?.selectedModelId ?? provider?.models[0]?.id ?? "");
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
    setApiKey("");
    setError("");
  };

  const save = async (refreshCatalog: boolean) => {
    setBusy(true);
    setError("");
    try {
      let next = await repository.saveSettings({
        activeChannel: channel,
        selectedModelId: modelId || null,
        apiKey: apiKey.trim() || undefined,
      });
      if (refreshCatalog) next = await repository.refreshModels(channel);
      applySettings(next);
      setApiKey("");
      onNotify(refreshCatalog ? "AI 通道已连接，模型目录已更新" : "AI 模型选择已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI 设置保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ai-settings-panel elevated-card" aria-labelledby="ai-settings-title">
      <div className="ai-settings-heading">
        <div className="settings-icon"><BrainCircuit size={21} /></div>
        <div>
          <h2 id="ai-settings-title">AI 自动整理</h2>
          <p>用于主题洞察与主题管理建议。OpenAI 和 Claude 模型统一通过 OpenRouter 使用。</p>
        </div>
      </div>

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
              ? <small>已连接</small>
              : null}
          </button>
        ))}
      </div>

      <div className="ai-settings-fields">
        <label>
          <span>API Key</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={activeProvider?.configured ? "已保存在 Windows 凭据库；留空不修改" : "粘贴 API Key"}
          />
        </label>
        <label>
          <span>模型</span>
          <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
            {!activeProvider?.models.length ? <option value="">连接后自动获取最新模型</option> : null}
            {activeProvider?.models.map((model) => (
              <option value={model.id} key={model.id}>
                {model.author === "anthropic" ? "Claude" : model.author === "openai" ? "OpenAI" : "DeepSeek"} · {model.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="ai-settings-error">{error}</p> : null}

      <div className="ai-settings-footer">
        <div>
          <span>{settings?.usage.taskCount ?? 0} 个任务</span>
          <span>{(settings?.usage.totalTokens ?? 0).toLocaleString("zh-CN")} tokens</span>
          <span>${(settings?.usage.knownCostUsd ?? 0).toFixed(4)}</span>
        </div>
        <button type="button" disabled={busy} onClick={() => void save(false)}>
          <Save size={15} />保存选择
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void save(true)}>
          <RefreshCw size={15} className={busy ? "spinning" : ""} />
          {busy ? "正在连接…" : "保存并更新模型"}
        </button>
      </div>
    </section>
  );
}
