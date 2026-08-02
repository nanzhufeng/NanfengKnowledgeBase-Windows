import { describe, expect, it } from "vitest";
import type { AttachmentItem } from "../domain/models";
import { attachmentPreviewKind } from "./attachmentPreview";

const item = (fileName: string, mimeType: string | null): AttachmentItem => ({
  id: 1,
  recordId: 1,
  fileName,
  storedPath: `D:\\attachments\\${fileName}`,
  originalPath: null,
  mimeType,
  sizeBytes: 10,
  sha256: "hash",
  createdAt: "2026-07-31T00:00:00Z",
});

describe("attachmentPreviewKind", () => {
  it("recognizes images and pdf by either MIME type or extension", () => {
    expect(attachmentPreviewKind(item("screen.jpg", null))).toBe("image");
    expect(attachmentPreviewKind(item("document.bin", "application/pdf"))).toBe("pdf");
  });

  it("keeps common text and media in the app preview", () => {
    expect(attachmentPreviewKind(item("notes.md", null))).toBe("text");
    expect(attachmentPreviewKind(item("voice.m4a", null))).toBe("audio");
    expect(attachmentPreviewKind(item("clip.mp4", null))).toBe("video");
  });
});
