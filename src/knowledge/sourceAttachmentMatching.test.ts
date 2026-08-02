import { describe, expect, it } from "vitest";
import type { AttachmentItem } from "../domain/models";
import {
  resolveSourceAssetAttachment,
  sourceAssetIsImage,
} from "./sourceAttachmentMatching";

const attachment = (overrides: Partial<AttachmentItem> = {}): AttachmentItem => ({
  id: 1,
  recordId: 8,
  fileName: "ZSXQ_20260521_141754799.jpg",
  storedPath: "D:\\isolated\\attachments\\file_abc__ZSXQ_20260521_141754799.jpg",
  originalPath: "D:\\isolated\\imports\\chatgpt.zip#file_abc.dat",
  mimeType: "image/jpeg",
  sizeBytes: 128,
  sha256: "a".repeat(64),
  createdAt: "2026-07-29T00:00:00Z",
  ...overrides,
});

describe("source attachment matching", () => {
  it("matches a ChatGPT asset pointer to the source-owned archived image", () => {
    expect(resolveSourceAssetAttachment({
      fileUuid: "sediment://file_abc",
      fileName: "图片 file_abc",
      kind: "image",
      mimeType: null,
      sizeBytes: null,
    }, [attachment()])?.id).toBe(1);
  });

  it("matches a jpg by its visible original file name", () => {
    expect(resolveSourceAssetAttachment({
      fileUuid: null,
      fileName: "ZSXQ_20260521_141754799.jpg",
      kind: "file",
      mimeType: null,
      sizeBytes: null,
    }, [attachment()])?.id).toBe(1);
  });

  it("renders jpg attachments as images even when imported metadata calls them files", () => {
    expect(sourceAssetIsImage({
      fileUuid: null,
      fileName: "ZSXQ_20260521_141754799.jpg",
      kind: "file",
      mimeType: null,
      sizeBytes: null,
    }, attachment({ mimeType: null }))).toBe(true);
  });
});
