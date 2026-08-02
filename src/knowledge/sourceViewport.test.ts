import { describe, expect, it } from "vitest";
import {
  centeredSourceScrollTop,
  shouldResetSourceArchiveEntry,
  sourceCardIsFullyVisible,
} from "./sourceViewport";

describe("centeredSourceScrollTop", () => {
  it("centers a正文目标 inside its own viewport", () => {
    expect(centeredSourceScrollTop({
      targetOffsetTop: 900,
      targetHeight: 40,
      viewportHeight: 500,
      scrollHeight: 2_000,
    })).toBe(670);
  });

  it("clamps targets near the beginning to the top", () => {
    expect(centeredSourceScrollTop({
      targetOffsetTop: 80,
      targetHeight: 40,
      viewportHeight: 500,
      scrollHeight: 2_000,
    })).toBe(0);
  });

  it("clamps targets near the end to the container maximum", () => {
    expect(centeredSourceScrollTop({
      targetOffsetTop: 1_900,
      targetHeight: 40,
      viewportHeight: 500,
      scrollHeight: 2_000,
    })).toBe(1_500);
  });
});

describe("shouldResetSourceArchiveEntry", () => {
  it("resets a normal sidebar entry instead of replaying old positioning", () => {
    expect(shouldResetSourceArchiveEntry({
      previousMode: "knowledge",
      nextMode: "sources",
      hasNavigationTarget: false,
    })).toBe(true);
  });

  it("preserves a new explicit cross-page navigation target", () => {
    expect(shouldResetSourceArchiveEntry({
      previousMode: "knowledge",
      nextMode: "sources",
      hasNavigationTarget: true,
    })).toBe(false);
  });

  it("does not reset while already working in the source archive", () => {
    expect(shouldResetSourceArchiveEntry({
      previousMode: "sources",
      nextMode: "sources",
      hasNavigationTarget: false,
    })).toBe(false);
  });
});

describe("sourceCardIsFullyVisible", () => {
  it("keeps the connector only while the entire selected card is in the readable list viewport", () => {
    expect(sourceCardIsFullyVisible({
      cardTop: 220,
      cardBottom: 310,
      viewportTop: 100,
      viewportBottom: 700,
      occlusionBottom: 190,
    })).toBe(true);
  });

  it("hides the connector before a selected card enters the sticky filter area", () => {
    expect(sourceCardIsFullyVisible({
      cardTop: 170,
      cardBottom: 260,
      viewportTop: 100,
      viewportBottom: 700,
      occlusionBottom: 190,
    })).toBe(false);
  });

  it("hides the connector as soon as the selected card leaves the bottom edge", () => {
    expect(sourceCardIsFullyVisible({
      cardTop: 650,
      cardBottom: 730,
      viewportTop: 100,
      viewportBottom: 700,
      occlusionBottom: 190,
    })).toBe(false);
  });
});
