import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { invoke } from "@tauri-apps/api/core";
import type { ReadableSourceMessage } from "../domain/importedContent";

type CalloutTone = "info" | "tip" | "success" | "warning" | "danger" | "question" | "quote";

const calloutAliases: Record<string, { tone: CalloutTone; icon: string; label: string }> = {
  note: { tone: "info", icon: "📝", label: "笔记" },
  info: { tone: "info", icon: "ℹ️", label: "信息" },
  abstract: { tone: "info", icon: "📋", label: "摘要" },
  summary: { tone: "info", icon: "📋", label: "摘要" },
  tldr: { tone: "info", icon: "📋", label: "摘要" },
  tip: { tone: "tip", icon: "💡", label: "提示" },
  hint: { tone: "tip", icon: "💡", label: "提示" },
  important: { tone: "tip", icon: "◆", label: "重要" },
  success: { tone: "success", icon: "✅", label: "完成" },
  check: { tone: "success", icon: "✅", label: "完成" },
  done: { tone: "success", icon: "✅", label: "完成" },
  warning: { tone: "warning", icon: "⚠️", label: "警告" },
  caution: { tone: "warning", icon: "⚠️", label: "注意" },
  attention: { tone: "warning", icon: "⚠️", label: "注意" },
  danger: { tone: "danger", icon: "⛔", label: "危险" },
  error: { tone: "danger", icon: "⛔", label: "错误" },
  failure: { tone: "danger", icon: "⛔", label: "失败" },
  fail: { tone: "danger", icon: "⛔", label: "失败" },
  bug: { tone: "danger", icon: "🐞", label: "问题" },
  question: { tone: "question", icon: "❓", label: "问题" },
  help: { tone: "question", icon: "❓", label: "帮助" },
  faq: { tone: "question", icon: "❓", label: "问答" },
  todo: { tone: "question", icon: "☑️", label: "待办" },
  quote: { tone: "quote", icon: "❝", label: "引用" },
  cite: { tone: "quote", icon: "❝", label: "引用" },
};

const toneByIcon: Array<[string, CalloutTone]> = [
  ["📝", "info"], ["ℹ️", "info"], ["📋", "info"],
  ["💡", "tip"], ["◆", "tip"],
  ["✅", "success"],
  ["⚠️", "warning"],
  ["⛔", "danger"], ["🐞", "danger"],
  ["❓", "question"], ["☑️", "question"],
  ["❝", "quote"],
];

export function prepareObsidianMarkdown(value: string): string {
  return value
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/^>\s*\[!([a-z-]+)\][+-]?\s*(.*)$/gim, (match, type, title) => {
      const callout = calloutAliases[String(type).toLowerCase()];
      if (!callout) return match;
      return `> **${callout.icon} ${title || callout.label}**`;
    })
    .replace(/!\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, (_match, target) => `**📎 附件：${target}**`)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "[$2](#note=$1)")
    .replace(/\[\[([^\]]+)\]\]/g, "[$1](#note=$1)");
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

export function calloutToneFromText(value: string): CalloutTone | null {
  const normalized = value.trimStart();
  return toneByIcon.find(([icon]) => normalized.startsWith(icon))?.[1] ?? null;
}

async function openExternalLink(href: string) {
  if ("__TAURI_INTERNALS__" in window) {
    await invoke("open_external_url", { url: href });
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}

function formatReadableDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function ReadableMessageContent({
  message,
  compact = false,
  children,
}: {
  message: ReadableSourceMessage;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`source-message ${message.role === "用户" ? "human" : "assistant"} ${compact ? "compact" : ""}`}>
      <div className="source-message-header">
        <strong>{message.role}</strong>
        {message.createdAt ? <span>{formatReadableDateTime(message.createdAt)}</span> : null}
      </div>
      {message.text ? (
        message.role === "助手"
          ? <AssistantMessageContent value={message.text} />
          : <MarkdownContent value={message.text} />
      ) : null}
      {children}
    </section>
  );
}

export function isSafeEmbeddedImageSource(src: string | undefined): boolean {
  if (!src) return false;
  const normalized = src.trim();
  if (!normalized || normalized.startsWith("//")) return false;
  if (/^https?:/i.test(normalized)) return false;
  return /^(?:data:image\/|blob:|asset:|https?:\/\/asset\.localhost\/|\/|\.{0,2}\/|[^:]+$)/i.test(normalized);
}

export default function MarkdownContent({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          blockquote: ({ children, className: blockquoteClassName, ...props }) => {
            const tone = calloutToneFromText(nodeText(children));
            const classes = [
              blockquoteClassName,
              tone ? "markdown-callout" : "markdown-quote",
              tone ? `markdown-callout-${tone}` : "",
            ].filter(Boolean).join(" ");
            return <blockquote {...props} className={classes}>{children}</blockquote>;
          },
          a: ({ href, children, ...props }) => (
            <a
              {...props}
              href={href}
              onClick={(event) => {
                if (!href) return;
                if (href.startsWith("#note=")) {
                  event.preventDefault();
                  return;
                }
                if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
                  event.preventDefault();
                  void openExternalLink(href);
                }
              }}
              title={href?.startsWith("#note=") ? "内部笔记链接（可在搜索中定位）" : undefined}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }) => {
            if (!isSafeEmbeddedImageSource(src)) {
              return (
                <span className="markdown-remote-image-blocked" role="note">
                  远程图片已阻止自动加载
                  {src && /^https?:/i.test(src) ? (
                    <a
                      href={src}
                      onClick={(event) => {
                        event.preventDefault();
                        void openExternalLink(src);
                      }}
                    >
                      手动打开
                    </a>
                  ) : null}
                </span>
              );
            }
            return <img {...props} src={src} alt={alt ?? ""} loading="lazy" />;
          },
        }}
      >
        {prepareObsidianMarkdown(value)}
      </ReactMarkdown>
    </div>
  );
}

export function AssistantMessageContent({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/);
  const firstProcessIndex = paragraphs.findIndex((paragraph) => {
    const latin = paragraph.match(/[A-Za-z]/g)?.length ?? 0;
    const chinese = paragraph.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    return latin > 80
      && latin > chinese * 5
      && /\b(is asking|i need to|i should|i(?:'m| am) considering|core issue|key assumption|assessment|need to focus|user wants|the user)\b/i.test(paragraph);
  });
  if (firstProcessIndex < 0) return <MarkdownContent value={value} />;

  let visibleStart = paragraphs.findIndex((paragraph, index) =>
    index > firstProcessIndex && /[\u3400-\u9fff]/.test(paragraph));
  if (visibleStart < 0) visibleStart = paragraphs.length;
  const hidden = paragraphs.slice(firstProcessIndex, visibleStart).join("\n\n");
  const visible = [
    ...paragraphs.slice(0, firstProcessIndex),
    ...paragraphs.slice(visibleStart),
  ].join("\n\n");
  return (
    <>
      {visible.trim() ? <MarkdownContent value={visible} /> : null}
      <details className="hidden-process-content">
        <summary>显示已折叠的英文过程信息</summary>
        <MarkdownContent value={hidden} />
      </details>
    </>
  );
}
