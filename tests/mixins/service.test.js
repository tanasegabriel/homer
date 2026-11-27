import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import service from "@/mixins/service.js";
import updateScheduler from "@/utils/updateScheduler.js";

enableAutoUnmount(afterEach);

const respond = (overrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: 1 }),
  text: async () => "plain",
  ...overrides,
});

const stubFetch = (overrides) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => respond(overrides)),
  );

const mountCard = (item, { proxy, config, options } = {}) =>
  mount(
    {
      mixins: [service],
      data: () => ({ serverError: null }),
      render: () => null,
      ...options,
    },
    {
      props: { item, proxy },
      global: { provide: { config: () => config } },
    },
  );

describe("fetch", () => {
  it.each([
    [{ url: "http://svc.local/" }, "/api/x", "http://svc.local/api/x"],
    [{ url: "http://svc.local" }, "api/x", "http://svc.local/api/x"],
    [{ url: "http://a", endpoint: "http://b/" }, "/api", "http://b/api"],
    [{ url: "http://svc.local/" }, "", "http://svc.local"],
  ])("with %o requests %s at %s", async (item, path, expected) => {
    stubFetch();
    await mountCard(item).vm.fetch(path);
    expect(fetch).toHaveBeenCalledWith(expected, expect.anything());
  });

  it("bypasses the cache by default", async () => {
    stubFetch();
    await mountCard({ url: "http://svc.local" }).vm.fetch("/");
    expect(fetch.mock.calls[0][1]).toEqual({
      cache: "no-cache",
      headers: {},
    });
  });

  it("layers the card's init over the proxy and item settings", async () => {
    stubFetch();
    const card = mountCard(
      { url: "http://svc.local", headers: { "X-Item": "i" } },
      { proxy: { useCredentials: true, headers: { "X-Key": "proxy" } } },
    );

    await card.vm.fetch("/", {
      method: "POST",
      cache: "default",
      headers: { "x-key": "card" },
    });

    expect(fetch.mock.calls[0][1]).toEqual({
      credentials: "include",
      method: "POST",
      cache: "default",
      headers: { "x-key": "card", "x-item": "i" },
    });
  });

  it("parses JSON unless asked for text", async () => {
    stubFetch();
    const card = mountCard({ url: "http://svc.local" });
    expect(await card.vm.fetch("/")).toEqual({ ok: 1 });
    expect(await card.vm.fetch("/", {}, false)).toBe("plain");
  });

  it("rejects a failed response, keeping it as the cause", async () => {
    stubFetch({ ok: false, status: 503 });
    const error = await mountCard({ url: "http://svc.local" })
      .vm.fetch("/")
      .catch((e) => e);

    expect(error.message).toBe("Failed to fetch resource: (503 error)");
    expect(error.cause.status).toBe(503);
  });

  it("honours successCodes", async () => {
    stubFetch({ ok: false, status: 401 });
    const accepted = mountCard({
      url: "http://svc.local",
      successCodes: [401],
    });
    await expect(accepted.vm.fetch("/")).resolves.toEqual({ ok: 1 });

    stubFetch({ ok: true, status: 200 });
    const refused = mountCard({ url: "http://svc.local", successCodes: [204] });
    await expect(refused.vm.fetch("/")).rejects.toThrow("200 error");
  });
});

describe("load", () => {
  it("clears serverError when every request succeeds", async () => {
    const card = mountCard({});
    await card.vm.load(Promise.resolve(1), Promise.resolve(2));
    expect(card.vm.serverError).toBe(false);
  });

  it("sets serverError once every request has settled", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const card = mountCard({});
    let finished = false;

    await card.vm.load(
      Promise.reject(new Error("down")),
      flushPromises().then(() => (finished = true)),
    );

    expect(card.vm.serverError).toBe(true);
    expect(finished).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe("optional", () => {
  it("turns a failure into null with a warning", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const card = mountCard({});

    expect(await card.vm.optional(Promise.reject(new Error("no")))).toBe(null);
    expect(await card.vm.optional(Promise.resolve(3))).toBe(3);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe("requireConfig", () => {
  it("passes when every key is set", () => {
    const card = mountCard({ apikey: "k", node: "n" });
    expect(card.vm.requireConfig("apikey", "node")).toBe(true);
    expect(card.vm.serverError).toBe(null);
  });

  it("names the missing keys and flags the card", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const card = mountCard({ name: "NAS", node: "n" });

    expect(card.vm.requireConfig("apikey", "node", "user")).toBe(false);
    expect(card.vm.serverError).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      'Missing apikey, user in config.yml for the "NAS" entry.',
    );
  });
});

describe("status helpers", () => {
  it.each([
    [null, null],
    [true, { state: "offline", label: "offline" }],
    [false, { state: "online", label: "online" }],
  ])("reachabilityStatus with serverError %s", async (serverError, status) => {
    const card = mountCard({});
    card.vm.serverError = serverError;
    expect(card.vm.reachabilityStatus()).toEqual(status);
  });

  it("shows the connection badge only after a failure", () => {
    const card = mountCard({ type: "Radarr" });
    expect(card.vm.connectionBadge()).toMatchObject({
      key: "serverError",
      value: null,
      tone: "danger",
    });

    card.vm.serverError = true;
    expect(card.vm.connectionBadge().value).toBe("?");
    expect(card.vm.connectionBadge().label).toContain("Radarr API");
  });

  it("hides the values listed in hide", () => {
    const card = mountCard({ hide: ["version"] });
    expect(card.vm.isValueShown("version")).toBe(false);
    expect(card.vm.isValueShown("status")).toBe(true);
  });
});

describe("update interval", () => {
  it.each([
    [{ updateIntervalMs: 5000 }, undefined, 5000],
    [{ updateIntervalMs: "5000" }, undefined, 5000],
    [{ updateIntervalMs: false }, { updateIntervalMs: 30000 }, 0],
    [{ updateIntervalMs: 0 }, { updateIntervalMs: 30000 }, 0],
    [{}, { updateIntervalMs: 30000 }, 30000],
    [{}, {}, 0],
    [{}, undefined, 0],
  ])("item %o with global %o gives %i", (item, config, expected) => {
    expect(mountCard(item, { config }).vm.getUpdateInterval()).toBe(expected);
  });

  it("still reads a deprecated key, with a warning", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const card = mountCard({ name: "Old", checkInterval: 10000 });

    expect(card.vm.getUpdateInterval()).toBe(10000);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[DEPRECATED] Service "Old"'),
    );
  });

  it("prefers updateIntervalMs over a deprecated key", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const card = mountCard({ updateIntervalMs: 2000, checkInterval: 10000 });

    expect(card.vm.getUpdateInterval()).toBe(2000);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("auto update", () => {
  const fetchData = vi.fn();

  it("registers fetchData and leaves the scheduler on unmount", () => {
    const register = vi
      .spyOn(updateScheduler, "register")
      .mockImplementation(() => {});
    const unregister = vi
      .spyOn(updateScheduler, "unregister")
      .mockImplementation(() => {});

    const card = mountCard(
      { updateIntervalMs: 5000 },
      { options: { methods: { fetchData } } },
    );
    expect(register).toHaveBeenCalledWith(card.vm, 5000, card.vm.fetchData);

    card.unmount();
    expect(unregister).toHaveBeenCalledWith(card.vm);
  });

  it("prefers autoUpdateMethod", () => {
    const register = vi
      .spyOn(updateScheduler, "register")
      .mockImplementation(() => {});
    const refresh = vi.fn();

    mountCard(
      { updateIntervalMs: 5000 },
      {
        options: {
          methods: { fetchData },
          created() {
            this.autoUpdateMethod = refresh;
          },
        },
      },
    );

    expect(register).toHaveBeenCalledWith(expect.anything(), 5000, refresh);
  });

  it.each([
    ["autoUpdate is false", { autoUpdate: false, methods: { fetchData } }],
    ["there is nothing to call", {}],
  ])("skips the scheduler when %s", (_, options) => {
    const register = vi.spyOn(updateScheduler, "register");
    mountCard({ updateIntervalMs: 5000 }, { options });
    expect(register).not.toHaveBeenCalled();
  });

  it("skips the scheduler without an interval", () => {
    const register = vi.spyOn(updateScheduler, "register");
    mountCard({}, { options: { methods: { fetchData } } });
    expect(register).not.toHaveBeenCalled();
  });

  it("calls fetchData once on create", () => {
    const load = vi.fn();
    mountCard({}, { options: { methods: { fetchData: load } } });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
