import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import App from "@/App.vue";
import ServiceGroup from "@/components/ServiceGroup.vue";

enableAutoUnmount(afterEach);

const ROOT = "assets/config.yml";
const REMOTE = "https://config.example/homer.yml";

const respond = ({ status = 200, body = "", redirected = false } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  redirected,
  text: async () => body,
});

const serve = (routes) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => respond(routes[url] ?? { status: 404 })),
  );

const mountApp = async () => {
  const wrapper = shallowMount(App);
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  window.location.hash = "";
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("getConfig", () => {
  it.each([
    ["is missing", { status: 404 }],
    ["redirects", { redirected: true, body: "<html></html>" }],
  ])("returns null when the root configuration %s", async (_, route) => {
    serve({ [ROOT]: route });
    const app = await mountApp();
    expect(await app.vm.getConfig()).toBe(null);
  });

  it("rejects any other root failure", async () => {
    serve({ [ROOT]: { status: 500 } });
    const app = await mountApp();
    await expect(app.vm.getConfig()).rejects.toThrow(`HTTP 500 for ${ROOT}`);
  });

  it("parses YAML, including merge keys", async () => {
    serve({
      [ROOT]: {
        body: "base: &base\n  a: 1\nitem:\n  <<: *base\n  b: 2\n",
      },
    });
    const app = await mountApp();
    expect(await app.vm.getConfig()).toEqual({
      base: { a: 1 },
      item: { a: 1, b: 2 },
    });
  });

  it("reads an empty file as an empty configuration", async () => {
    serve({ [ROOT]: { body: "" } });
    const app = await mountApp();
    expect(await app.vm.getConfig()).toEqual({});
  });

  it("follows externalConfig", async () => {
    serve({
      [ROOT]: { body: `externalConfig: ${REMOTE}\ntitle: Local\n` },
      [REMOTE]: { body: "title: Remote\n" },
    });
    const app = await mountApp();
    expect(await app.vm.getConfig()).toEqual({ title: "Remote" });
  });

  it("sends the externalConfig credentials and headers, not the root proxy", async () => {
    serve({
      [ROOT]: {
        body: [
          "proxy:",
          "  useCredentials: true",
          "  headers:",
          "    X-Proxy: root",
          "externalConfig:",
          `  url: ${REMOTE}`,
          "  useCredentials: true",
          "  headers:",
          "    Authorization: Bearer token",
        ].join("\n"),
      },
      [REMOTE]: { body: "title: Remote\n" },
    });
    const app = await mountApp();
    fetch.mockClear();

    await app.vm.getConfig();

    expect(fetch).toHaveBeenLastCalledWith(REMOTE, {
      cache: "no-cache",
      credentials: "include",
      headers: { authorization: "Bearer token" },
    });
  });

  it.each([
    ["is missing", { status: 404 }, `HTTP 404 for ${REMOTE}`],
    ["fails", { status: 500 }, `HTTP 500 for ${REMOTE}`],
    [
      "returns a web page",
      { body: "<!DOCTYPE html><html></html>" },
      "returned a web page",
    ],
    ["returns a list", { body: "- a\n- b\n" }, "didn't return a configuration"],
    ["returns a string", { body: "hello\n" }, "didn't return a configuration"],
  ])("rejects an externalConfig that %s", async (_, route, message) => {
    serve({
      [ROOT]: { body: `externalConfig: ${REMOTE}\n` },
      [REMOTE]: route,
    });
    const app = await mountApp();
    await expect(app.vm.getConfig()).rejects.toThrow(message);
  });

  it.each([
    ["itself", REMOTE],
    ["the root configuration", ROOT],
  ])("rejects an externalConfig that loops back to %s", async (_, target) => {
    serve({
      [ROOT]: { body: `externalConfig: ${REMOTE}\n` },
      [REMOTE]: { body: `externalConfig: ${target}\n` },
    });
    const app = await mountApp();
    await expect(app.vm.getConfig()).rejects.toThrow("loops back");
  });
});

describe("buildDashboard", () => {
  it("renders the configured services", async () => {
    serve({
      [ROOT]: {
        body: [
          "title: Home",
          "subtitle: Lab",
          "services:",
          "  - name: Apps",
          "    items:",
          "      - name: One",
        ].join("\n"),
      },
    });
    const app = await mountApp();

    expect(app.findAllComponents(ServiceGroup)).toHaveLength(1);
    expect(document.title).toBe("Home | Lab");
    expect(app.vm.configNotFound).toBe(false);
  });

  it("flags a missing page and clears the flag once it is found", async () => {
    window.location.hash = "#media";
    serve({ [ROOT]: { body: "title: Home\n" } });
    const app = await mountApp();

    expect(fetch).toHaveBeenCalledWith("assets/media.yml", expect.anything());
    expect(app.vm.currentPage).toBe("media");
    expect(app.vm.configNotFound).toBe(true);

    serve({
      [ROOT]: { body: "title: Home\n" },
      "assets/media.yml": { body: "subtitle: Media\n" },
    });
    await app.vm.buildDashboard();

    expect(app.vm.configNotFound).toBe(false);
    expect(app.vm.config).toMatchObject({ title: "Home", subtitle: "Media" });
  });

  it("shows a loading error as a message", async () => {
    serve({ [ROOT]: { status: 500 } });
    const app = await mountApp();

    expect(app.vm.config.message).toMatchObject({
      title: "⚠️ Error loading configuration",
      style: "is-danger",
    });
  });

  it("ignores a build that finishes after a newer one", async () => {
    let release;
    const slow = new Promise((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() =>
          slow.then(() => respond({ body: "title: Old\n" })),
        )
        .mockImplementation(async () => respond({ body: "title: New\n" })),
    );

    const app = shallowMount(App);
    await app.vm.buildDashboard();
    expect(app.vm.config.title).toBe("New");

    release();
    await flushPromises();
    expect(app.vm.config.title).toBe("New");
  });
});
