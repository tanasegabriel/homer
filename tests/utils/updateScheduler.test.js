import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let scheduler;
let hidden;

const component = (uid) => ({ $: { uid } });

const setHidden = (value) => {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(async () => {
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.resetModules();
  scheduler = (await import("@/utils/updateScheduler.js")).default;
});

afterEach(() => {
  scheduler.registeredComponents.clear();
  scheduler.stopGlobalTimer();
  vi.useRealTimers();
  delete document.hidden;
});

describe("updateScheduler", () => {
  it("waits a full interval before the first update", () => {
    const update = vi.fn();
    scheduler.register(component(1), 3000, update);

    vi.advanceTimersByTime(2000);
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("does not update a late component early", () => {
    scheduler.register(component(1), 1000, vi.fn());
    vi.advanceTimersByTime(5000);

    const update = vi.fn();
    scheduler.register(component(2), 3000, update);

    vi.advanceTimersByTime(2000);
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("calls the update on its component", () => {
    const card = component(1);
    const update = vi.fn();
    scheduler.register(card, 1000, update);

    vi.advanceTimersByTime(1000);
    expect(update.mock.contexts[0]).toBe(card);
  });

  it("does not start while the tab is hidden", () => {
    hidden = true;
    const update = vi.fn();
    scheduler.register(component(1), 2000, update);

    vi.advanceTimersByTime(5000);
    expect(update).not.toHaveBeenCalled();

    setHidden(false);
    vi.advanceTimersByTime(2000);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("pauses while the tab is hidden", () => {
    const update = vi.fn();
    scheduler.register(component(1), 1000, update);
    vi.advanceTimersByTime(1000);

    setHidden(true);
    vi.advanceTimersByTime(5000);
    expect(update).toHaveBeenCalledTimes(1);

    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("stops the timer when the last component leaves", () => {
    const first = component(1);
    const second = component(2);
    scheduler.register(first, 1000, vi.fn());
    scheduler.register(second, 1000, vi.fn());

    scheduler.unregister(first);
    expect(scheduler.globalTimer).not.toBe(null);

    scheduler.unregister(second);
    expect(scheduler.globalTimer).toBe(null);
  });

  it("raises an interval below one second to one second", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const update = vi.fn();
    scheduler.register(component(1), 200, update);

    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps updating the others when one update throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const update = vi.fn();
    scheduler.register(component(1), 1000, () => {
      throw new Error("boom");
    });
    scheduler.register(component(2), 1000, update);

    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects an invalid registration", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduler.register(null, 1000, vi.fn());
    scheduler.register(component(1), 0, vi.fn());
    scheduler.register(component(1), 1000, undefined);

    expect(scheduler.registeredComponents.size).toBe(0);
    expect(scheduler.globalTimer).toBe(null);
  });
});
