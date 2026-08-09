import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AttachmentPreview } from "../../src/components/AttachmentPreview";
import { SourceAttachmentAsset } from "../../src/components/SourceAttachmentAsset";
import "../../src/styles.css";

const imageAttachment = {
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

function VideoAttachmentPreviewHarness() {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const portrait = new URLSearchParams(window.location.search).get("ratio") === "portrait";
    canvas.width = portrait ? 360 : 640;
    canvas.height = portrait ? 640 : 360;
    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(12);
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    let frame = 0;
    let url = "";
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    let timer = 0;
    const drawFrame = () => {
      if (!context) return;
      context.fillStyle = frame % 2 === 0 ? "#132132" : "#243b57";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.font = "700 42px sans-serif";
      context.fillText("南枫视频预览验收", 120, 190);
      frame += 1;
    };
    recorder.addEventListener("stop", () => {
      window.clearInterval(timer);
      url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      setSource(url);
    });
    drawFrame();
    recorder.start(100);
    timer = window.setInterval(drawFrame, 80);
    const stopTimer = window.setTimeout(() => recorder.stop(), 1200);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stopTimer);
      stream.getTracks().forEach((track) => track.stop());
      if (recorder.state !== "inactive") recorder.stop();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  if (!source) return <span>正在生成隔离视频验收源…</span>;
  return <AttachmentPreview
    attachment={{
      ...imageAttachment,
      fileName: "visual-media-contract.webm",
      storedPath: source,
      mimeType: "video/webm",
    }}
    onClose={() => undefined}
    onOpenOriginal={() => undefined}
    onRevealAttachment={() => undefined}
  />;
}

function AttachmentPreviewHarness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <AttachmentPreview
      attachment={imageAttachment}
      onClose={() => setOpen(false)}
      onOpenOriginal={() => undefined}
      onRevealAttachment={() => undefined}
    />
  ) : (
    <button type="button" onClick={() => setOpen(true)}>重新打开图片预览</button>
  );
}

function BoundedAttachmentHarness() {
  return <main style={{ height: "100vh", overflowY: "auto", padding: 12 }} data-testid="bounded-scroll">
    {Array.from({ length: 48 }, (_, index) => {
      const fileName = `pressure-document-${String(index + 1).padStart(2, "0")}.pdf`;
      return <div key={fileName} style={{ minHeight: 180 }}>
        <SourceAttachmentAsset
          asset={{ fileUuid: `asset-${index}`, fileName, kind: "file", mimeType: "application/pdf", sizeBytes: 1024 }}
          attachment={{
            ...imageAttachment,
            id: index + 100,
            fileName,
            storedPath: `/tests/visual/${fileName}`,
            mimeType: "application/pdf",
          }}
          onOpenAttachment={() => undefined}
          onRevealAttachment={() => undefined}
        />
      </div>;
    })}
  </main>;
}

const mode = new URLSearchParams(window.location.search).get("kind");
createRoot(document.getElementById("root")!).render(
  mode === "video"
    ? <VideoAttachmentPreviewHarness />
    : mode === "bounded"
      ? <BoundedAttachmentHarness />
      : <AttachmentPreviewHarness />,
);
