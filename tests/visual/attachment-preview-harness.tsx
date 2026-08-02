import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AttachmentPreview } from "../../src/components/AttachmentPreview";
import "../../src/styles.css";

const attachment = {
  id: 1,
  recordId: 1,
  fileName: "source-archive-final-layout.png",
  storedPath: "/docs/screenshots/final-core-workspace/source-archive-final-layout.png",
  originalPath: null,
  mimeType: "image/png",
  sizeBytes: 1,
  sha256: "visual-harness",
  createdAt: "2026-08-01T00:00:00.000Z",
};

function AttachmentPreviewHarness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <AttachmentPreview
      attachment={attachment}
      onClose={() => setOpen(false)}
      onOpenOriginal={() => undefined}
    />
  ) : (
    <button type="button" onClick={() => setOpen(true)}>重新打开图片预览</button>
  );
}

createRoot(document.getElementById("root")!).render(<AttachmentPreviewHarness />);
