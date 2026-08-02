import { forwardRef, useEffect, useRef } from "react";
import type {
  ComponentType,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import {
  Braces,
  Building2,
  ChevronDown,
  Cloud,
  Cpu,
  Database,
  FileCheck2,
  FileText,
  LayoutGrid,
  RadioTower,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
} from "lucide-react";
import type { RecordStatus } from "../domain/models";

export type UnifiedNoteListSortMode = "default" | "desc" | "asc";

export function cycleUnifiedNoteListSortMode(
  mode: UnifiedNoteListSortMode,
): UnifiedNoteListSortMode {
  return mode === "default" ? "desc" : mode === "desc" ? "asc" : "default";
}

export function sortUnifiedNoteListItems<T>(
  items: T[],
  mode: UnifiedNoteListSortMode,
  resolveDate: (item: T) => string,
): T[] {
  if (mode === "default") return items;
  return [...items].sort((left, right) => mode === "asc"
    ? resolveDate(left).localeCompare(resolveDate(right))
    : resolveDate(right).localeCompare(resolveDate(left)));
}

export type NoteIconKey =
  | "ai"
  | "cloud"
  | "chip"
  | "security"
  | "finance"
  | "software"
  | "media"
  | "regulation"
  | "health"
  | "workflow"
  | "document"
  | "building"
  | "radio";

const noteIconMap: Record<NoteIconKey, ComponentType<{ size?: number }>> = {
  ai: Sparkles,
  cloud: Cloud,
  chip: Cpu,
  security: ShieldCheck,
  finance: Database,
  software: Braces,
  media: LayoutGrid,
  regulation: FileCheck2,
  health: Sprout,
  workflow: Settings,
  document: FileText,
  building: Building2,
  radio: RadioTower,
};

export function resolveNoteIconKey(...parts: Array<string | null | undefined>): NoteIconKey {
  const text = parts.filter(Boolean).join(" ");
  if (/安全|风控|验证|账号|隐私|漏洞|加密|security|risk/i.test(text)) return "security";
  if (/芯片|半导体|GPU|CPU|硬件|设备|Apple|Mac|iPhone/i.test(text)) return "chip";
  if (/金融|银行|投资|资本|现金流|股票|财报|支付|finance|bank/i.test(text)) return "finance";
  if (/影视|动画|视频|音频|VFX|合成|媒体|film|video/i.test(text)) return "media";
  if (/法规|政策|合规|监管|法律|regulation|policy/i.test(text)) return "regulation";
  if (/健康|医疗|药物|运动|睡眠|health|medical/i.test(text)) return "health";
  if (/代码|软件|开发|API|GitHub|Codex|编程|程序|software/i.test(text)) return "software";
  if (/工作流|自动化|流程|SOP|效率|workflow/i.test(text)) return "workflow";
  if (/人工智能|大模型|模型|ChatGPT|Claude|OpenAI|\bAI\b/i.test(text)) return "ai";
  if (/云|算力|数据中心|cloud/i.test(text)) return "cloud";
  if (/运营商|网络|通信|telegram|微信|QQ/i.test(text)) return "radio";
  if (/公司|企业|产业链|厂商|商业/i.test(text)) return "building";
  return "document";
}

export function formatNoteCardDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replaceAll("/", "-").slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replaceAll("/", "-");
}

export function NoteSemanticIcon({ iconKey }: { iconKey: NoteIconKey }) {
  const Icon = noteIconMap[iconKey];
  return <div className={`record-icon ${iconKey}`}><Icon size={16} /></div>;
}

export const UnifiedNoteListPanel = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function UnifiedNoteListPanel({ className = "", children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`unified-note-list-panel ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
});

export function UnifiedNoteListSearchRow({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`search-row unified-note-list-search-row ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function UnifiedNoteListToolbar({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`list-toolbar unified-note-list-toolbar ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export type UnifiedNoteListFilterField = {
  id: string;
  label: string;
  type: "select" | "date";
  value: string;
  options?: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

export const UNIFIED_NOTE_FILTER_ALL = "all";

export const UNIFIED_NOTE_STATUS_OPTIONS: Array<{ value: RecordStatus; label: string }> = [
  { value: "normal", label: "普通记录" },
  { value: "tracking", label: "持续跟踪" },
  { value: "verification", label: "待验证" },
  { value: "updated", label: "判断更新" },
];

function uniqueFilterValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function createUnifiedNoteSourceFilterField({
  value,
  sourceValues,
  onChange,
}: {
  value: string;
  sourceValues: string[];
  onChange: (value: string) => void;
}): UnifiedNoteListFilterField {
  return {
    id: "source",
    label: "来源",
    type: "select",
    value,
    options: [
      { value: UNIFIED_NOTE_FILTER_ALL, label: "全部来源" },
      ...uniqueFilterValues(sourceValues).map((source) => ({ value: source, label: source })),
    ],
    onChange,
  };
}

export function createUnifiedNoteStatusFilterField({
  value,
  onChange,
}: {
  value: typeof UNIFIED_NOTE_FILTER_ALL | RecordStatus;
  onChange: (value: typeof UNIFIED_NOTE_FILTER_ALL | RecordStatus) => void;
}): UnifiedNoteListFilterField {
  return {
    id: "status",
    label: "状态",
    type: "select",
    value,
    options: [
      { value: UNIFIED_NOTE_FILTER_ALL, label: "全部状态" },
      ...UNIFIED_NOTE_STATUS_OPTIONS,
    ],
    onChange: (nextValue) => onChange(nextValue as typeof UNIFIED_NOTE_FILTER_ALL | RecordStatus),
  };
}

export function createUnifiedNoteTopicFilterField({
  value,
  topicValues,
  onChange,
}: {
  value: string;
  topicValues: string[];
  onChange: (value: string) => void;
}): UnifiedNoteListFilterField {
  return {
    id: "topic",
    label: "主题",
    type: "select",
    value,
    options: [
      { value: UNIFIED_NOTE_FILTER_ALL, label: "全部主题" },
      ...uniqueFilterValues(topicValues).map((topic) => ({ value: topic, label: topic })),
    ],
    onChange,
  };
}

export function createUnifiedNoteDateFilterFields({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}): UnifiedNoteListFilterField[] {
  return [
    {
      id: "date-from",
      label: "起始日期",
      type: "date",
      value: dateFrom,
      onChange: onDateFromChange,
    },
    {
      id: "date-to",
      label: "结束日期",
      type: "date",
      value: dateTo,
      onChange: onDateToChange,
    },
  ];
}

export function matchesUnifiedNoteFilter(value: string, selectedValue: string): boolean {
  return selectedValue === UNIFIED_NOTE_FILTER_ALL || value === selectedValue;
}

export function UnifiedNoteListFilter({
  open,
  active,
  fields,
  onOpenChange,
  onReset,
  auxiliaryAction,
}: {
  open: boolean;
  active: boolean;
  fields: UnifiedNoteListFilterField[];
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  auxiliaryAction?: {
    label: string;
    onClick: () => void;
  };
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={containerRef} className="filter-wrap unified-note-list-filter-wrap">
      <button
        type="button"
        className={`filter-button ${active ? "active" : ""}`}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={17} /><span>筛选</span>
      </button>
      {open ? (
        <div className="filter-popover elevated-card unified-note-list-filter-popover">
          <strong>组合筛选</strong>
          {fields.map((field) => (
            <label key={field.id}>
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select value={field.value} onChange={(event) => field.onChange(event.target.value)}>
                  {(field.options ?? []).map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              )}
            </label>
          ))}
          {auxiliaryAction ? (
            <button
              type="button"
              className="unified-note-filter-auxiliary-action"
              onClick={() => {
                onOpenChange(false);
                auxiliaryAction.onClick();
              }}
            >
              {auxiliaryAction.label}
            </button>
          ) : null}
          <div className="filter-actions">
            <button type="button" onClick={onReset}>重置</button>
            <button type="button" className="selected" onClick={() => onOpenChange(false)}>应用</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UnifiedNoteListDisplayToolbar({
  className = "",
  label,
  count,
  countLabel,
  compactMode,
  sortMode,
  onToggleCompact,
  onCycleSort,
}: {
  className?: string;
  label: string;
  count: number;
  countLabel: string;
  compactMode: boolean;
  sortMode: UnifiedNoteListSortMode;
  onToggleCompact: () => void;
  onCycleSort: () => void;
}) {
  const sortLabel = sortMode === "default"
    ? "按更新时间"
    : sortMode === "desc"
      ? "最新优先"
      : "最早优先";
  const shortCountLabel = countLabel.startsWith("条") ? "条" : countLabel;

  return (
    <UnifiedNoteListToolbar className={`unified-note-list-display-toolbar ${className}`.trim()}>
      <div className="list-result-summary" aria-label={`${label} ${count} ${countLabel}`}>
        <span>{label}</span>
        <strong>{count}</strong>
        <em aria-hidden="true">{shortCountLabel}</em>
      </div>
      <div className="list-toolbar-actions">
        <button
          type="button"
          aria-pressed={compactMode}
          onClick={onToggleCompact}
        >
          {compactMode ? "舒展卡片" : "紧凑卡片"}
        </button>
        <button
          type="button"
          onClick={onCycleSort}
          aria-label={`当前${sortMode === "default" ? "默认顺序" : sortLabel}，点击切换排序`}
        >
          {sortLabel}
          <ChevronDown size={15} className={sortMode === "asc" ? "flipped" : ""} />
        </button>
      </div>
    </UnifiedNoteListToolbar>
  );
}

export function UnifiedNoteListLocator({
  className = "",
  count,
  value,
  currentIndex,
  itemLabel,
  onLocate,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  count: number;
  value: number;
  currentIndex: number;
  itemLabel: string;
  onLocate: (index: number) => void;
}) {
  if (count <= 0) return null;
  const clampIndex = (index: number) => Math.min(Math.max(index, 0), count - 1);
  const locatorIndex = clampIndex(value);
  const selectedIndex = clampIndex(currentIndex);

  return (
    <div className={`quick-locator unified-note-list-locator ${className}`.trim()} {...props}>
      <button type="button" title={`回到${itemLabel}列表顶部`} onClick={() => onLocate(0)}>顶部</button>
      <input
        type="range"
        min={1}
        max={count}
        value={locatorIndex + 1}
        onInput={(event) => onLocate(Number(event.currentTarget.value) - 1)}
        aria-label={`拖动快速定位${itemLabel}`}
      />
      <span>{locatorIndex + 1} / {count}</span>
      <button type="button" title={`回到当前选中${itemLabel}`} onClick={() => onLocate(selectedIndex)}>当前</button>
    </div>
  );
}

export function UnifiedNoteListCard({
  className = "",
  cardRef,
  recordId,
  sourceId,
  selected,
  menuOpen,
  compact = true,
  iconKey,
  title,
  theme,
  source,
  date,
  status,
  actions,
  onSelect,
}: {
  className?: string;
  cardRef?: Ref<HTMLElement>;
  recordId?: number;
  sourceId?: number;
  selected: boolean;
  menuOpen: boolean;
  compact?: boolean;
  iconKey: NoteIconKey;
  title: ReactNode;
  theme: ReactNode;
  source: ReactNode;
  date: string;
  status?: ReactNode;
  actions: ReactNode;
  onSelect: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  return (
    <section
      ref={cardRef}
      data-record-id={recordId}
      data-source-id={sourceId}
      className={`elevated-card unified-note-card ${className} ${selected ? "selected" : ""} ${menuOpen ? "menu-open" : ""} ${compact ? "compact" : ""} ${status ? "has-status" : ""}`.trim()}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <NoteSemanticIcon iconKey={iconKey} />
      <div className="unified-note-copy">
        <strong>{title}</strong>
        <small className="unified-note-meta">
          <span><b className="unified-note-meta-label">主题：</b>{theme}</span>
          <i aria-hidden="true">·</i>
          <span><b className="unified-note-meta-label">来源：</b>{source}</span>
        </small>
      </div>
      <time className="unified-note-date">{formatNoteCardDate(date)}</time>
      <div className="unified-note-actions">{actions}</div>
      {status ? <div className="unified-note-status">{status}</div> : null}
    </section>
  );
}
