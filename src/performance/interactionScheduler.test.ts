import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleIdleWork, yieldToInteraction } from "./interactionScheduler";

describe("interaction scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not start maintenance during the protected interaction window", () => {
    vi.useFakeTimers();
    const work = vi.fn();

    scheduleIdleWork(work, { delayMs: 600 });
    vi.advanceTimersByTime(599);
    expect(work).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("cancels work when the owning route is left", () => {
    vi.useFakeTimers();
    const work = vi.fn();
    const cancel = scheduleIdleWork(work, { delayMs: 600 });

    cancel();
    vi.runAllTimers();
    expect(work).not.toHaveBeenCalled();
  });

  it("reports an aborted long task without consuming another unit", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(yieldToInteraction(controller.signal)).resolves.toBe(false);
  });
});
