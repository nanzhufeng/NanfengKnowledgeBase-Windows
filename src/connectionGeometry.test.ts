import { describe, expect, it } from "vitest";
import {
  connectorMetricsEqual,
  connectionOpacity,
  measureCardToCardConnector,
} from "./connectionGeometry";

describe("connectionOpacity", () => {
  it("keeps the connector fully visible away from list edges", () => {
    expect(connectionOpacity(300, 100, 700)).toBe(1);
  });

  it("fades before reaching either list edge", () => {
    expect(connectionOpacity(132, 100, 700)).toBe(0.5);
    expect(connectionOpacity(668, 100, 700)).toBe(0.5);
  });

  it("hides the connector at and beyond list edges", () => {
    expect(connectionOpacity(100, 100, 700)).toBe(0);
    expect(connectionOpacity(80, 100, 700)).toBe(0);
    expect(connectionOpacity(700, 100, 700)).toBe(0);
    expect(connectionOpacity(720, 100, 700)).toBe(0);
  });
});

describe("measureCardToCardConnector", () => {
  it("starts at the source card edge and ends at the target card edge", () => {
    expect(measureCardToCardConnector(
      { left: 100, top: 40 },
      { left: 120, right: 360, top: 140, height: 80 },
      { left: 420 },
    )).toEqual({
      left: 260,
      top: 140,
      width: 60,
    });
  });

  it("does not extend backwards when cards touch or overlap", () => {
    expect(measureCardToCardConnector(
      { left: 0, top: 0 },
      { left: 20, right: 220, top: 50, height: 50 },
      { left: 210 },
    )).toEqual({
      left: 220,
      top: 75,
      width: 0,
    });
  });
});

describe("connectorMetricsEqual", () => {
  it("suppresses sub-pixel geometry noise and unchanged opacity", () => {
    expect(connectorMetricsEqual(
      { top: 100, left: 240, width: 18, opacity: 0.8 },
      { top: 100.1, left: 240.2, width: 18.2, opacity: 0.805 },
    )).toBe(true);
  });

  it("keeps meaningful position and visibility changes", () => {
    expect(connectorMetricsEqual(
      { top: 100, left: 240, width: 18, opacity: 0.8 },
      { top: 101, left: 240, width: 18, opacity: 0.8 },
    )).toBe(false);
    expect(connectorMetricsEqual(
      { top: 100, left: 240, width: 18, opacity: 0.8 },
      { top: 100, left: 240, width: 18, opacity: 0.6 },
    )).toBe(false);
  });
});
