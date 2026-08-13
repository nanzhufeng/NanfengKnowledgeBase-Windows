import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import type { AttachmentItem } from "../domain/models";
import { LOADING_LABEL } from "../ui/loadingLabel";
import MarkdownContent from "./MarkdownContent";

export function isMarkdownAttachment(fileName: string): boolean {
  return /\.(?:md|markdown)$/i.test(fileName);
}

/** 所有入口共用的受控文本附件读取与阅读视图。 */
export function AttachmentTextPreview({
  attachment,
  embedded = false,
}: {
  attachment: AttachmentItem;
  embedded?: boolean;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const markdown = useMemo(() => isMarkdownAttachment(attachment.fileName), [attachment.fileName]);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    void invoke<string>("read_attachment_text", { attachmentId: attachment.id })
      .then((value) => {
        if (!cancelled) setContent(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { cancelled = true; };
  }, [attachment.id, attachment.storedPath]);

  return (
    <div className={`attachment-text-reader ${embedded ? "is-embedded" : "is-dialog"}`}>
      {error ? <p className="attachment-text-state is-error">{error}</p> : null}
      {!error && content === null ? <p className="attachment-text-state">{LOADING_LABEL}</p> : null}
      {!error && content !== null && markdown ? <MarkdownContent value={content} /> : null}
      {!error && content !== null && !markdown ? <pre>{content}</pre> : null}
    </div>
  );
}
