import { describe, expect, it } from "vitest";
import { connectionOpacity } from "./connectionGeometry";

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
