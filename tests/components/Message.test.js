import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import Message from "@/components/Message.vue";

enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const ENDPOINT = "https://status.example/message";

const respond = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const serve = (body, init) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => respond(body, init)),
  );

const mountMessage = async (item) => {
  const wrapper = mount(Message, { props: { item } });
  await flushPromises();
  return wrapper;
};

const title = (wrapper) => wrapper.find(".message-header").text();
const body = (wrapper) => wrapper.find(".message-body");

describe("Message", () => {
  it("shows a static message without fetching", async () => {
    serve({});
    const message = await mountMessage({
      title: "Hi",
      content: "<b>there</b>",
    });

    expect(title(message)).toBe("Hi");
    expect(body(message).html()).toContain("<b>there</b>");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders nothing without a title or content", async () => {
    const message = await mountMessage({ style: "is-info" });
    expect(message.find(".message").exists()).toBe(false);
  });

  it("replaces the configured values with the remote ones", async () => {
    serve({ title: "Remote", content: "news" });
    const message = await mountMessage({
      url: ENDPOINT,
      title: "Local",
      content: "local",
    });

    expect(fetch).toHaveBeenCalledWith(ENDPOINT, {
      headers: { accept: "application/json" },
    });
    expect(title(message)).toBe("Remote");
    expect(body(message).text()).toBe("news");
  });

  it("keeps a configured value the endpoint leaves out", async () => {
    serve({ content: "news", title: null });
    const message = await mountMessage({ url: ENDPOINT, title: "Local" });

    expect(title(message)).toBe("Local");
    expect(body(message).text()).toBe("news");
  });

  it("maps the remote fields", async () => {
    serve({ headline: "Mapped", text: "body", extra: "ignored" });
    const message = await mountMessage({
      url: ENDPOINT,
      mapping: { title: "headline", content: "text" },
    });

    expect(title(message)).toBe("Mapped");
    expect(body(message).text()).toBe("body");
  });

  it("sanitizes remote HTML and says what it removed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    serve({ content: "<p>ok</p><form><button>go</button></form>" });
    const message = await mountMessage({ url: ENDPOINT });

    expect(body(message).find("p").text()).toBe("ok");
    expect(body(message).find("form").exists()).toBe(false);
    expect(message.find(".is-contained").exists()).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`XSS protection removed potentially unsafe HTML`),
      "form",
    );
  });

  it("keeps the configured content when nothing survives sanitizing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    serve({ content: "<script>void 0</script>" });
    const message = await mountMessage({ url: ENDPOINT, content: "local" });

    expect(body(message).text()).toBe("local");
  });

  it("trusts remote HTML with sanitize: false", async () => {
    serve({ content: "<form><button>go</button></form>" });
    const message = await mountMessage({ url: ENDPOINT, sanitize: false });

    expect(body(message).find("form").exists()).toBe(true);
    expect(message.find(".is-contained").exists()).toBe(false);
  });

  it.each([
    ["the request fails", () => Promise.reject(new TypeError("offline"))],
    [
      "the endpoint errors",
      async () => respond({}, { ok: false, status: 500 }),
    ],
    ["the body is not an object", async () => respond("text")],
    ["the body is null", async () => respond(null)],
  ])("keeps the configured message when %s", async (_, response) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(response));
    const message = await mountMessage({
      url: ENDPOINT,
      title: "Local",
      content: "local",
    });

    expect(title(message)).toBe("Local");
    expect(body(message).text()).toBe("local");
  });

  it("refreshes on refreshInterval until unmounted", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    serve({ title: "Remote" });
    const message = await mountMessage({
      url: ENDPOINT,
      refreshInterval: 1000,
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(fetch).toHaveBeenCalledTimes(2);

    message.unmount();
    vi.advanceTimersByTime(5000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("drops a response that arrives after the item changed", async () => {
    let release;
    const slow = new Promise((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() =>
          slow.then(() => respond({ title: "Old page" })),
        )
        .mockImplementation(async () => respond({ title: "New page" })),
    );

    const message = mount(Message, { props: { item: { url: ENDPOINT } } });
    await message.setProps({ item: { url: `${ENDPOINT}/next` } });
    await flushPromises();
    expect(title(message)).toBe("New page");

    release();
    await flushPromises();
    expect(title(message)).toBe("New page");
  });
});
