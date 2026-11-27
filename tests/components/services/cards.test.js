import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { parse } from "yaml";
import demo from "../../../dummy-data/demo.yml?raw";
import resolveMock from "../../../dummy-data/resolve.js";
import Generic from "@/components/services/Generic.vue";

enableAutoUnmount(afterEach);

const NOT_CARDS = ["Generic", "_error", "CopyToClipboard", "ThemeChooser"];

const cards = Object.fromEntries(
  Object.entries(import.meta.glob("/src/components/services/*.vue"))
    .map(([file, load]) => [file.split("/").pop().slice(0, -4), load])
    .filter(([name]) => !NOT_CARDS.includes(name)),
);

const items = parse(demo).services.flatMap((group) => group.items);
const types = new Set(items.map((item) => item.type));

let requests;

beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init = {}) => {
      const url = String(input);
      const file = resolveMock(url, { method: init.method, body: init.body });
      requests.push({ url, file });
      return file
        ? new Response(fs.readFileSync(file))
        : new Response(null, { status: 404, statusText: "Not Found" });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const settle = async () => {
  let seen;
  do {
    seen = requests.length;
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve));
  } while (seen !== requests.length);
};

describe("demo.yml", () => {
  it("has an entry for every card", () => {
    expect(Object.keys(cards).filter((name) => !types.has(name))).toEqual([]);
  });

  it("only lists existing cards", () => {
    expect([...types].filter((type) => !cards[type])).toEqual([]);
  });
});

describe.each(items.filter((item) => cards[item.type]))("$type", (item) => {
  it("loads its mock without an error", async () => {
    const { default: component } = await cards[item.type]();
    const card = mount(component, {
      props: { item },
      global: {
        components: { Generic },
        provide: { config: () => ({}) },
      },
    });

    await vi.waitFor(() => expect(card.vm.serverError).not.toBe(null));
    await settle();

    expect(requests.length).toBeGreaterThan(0);
    expect(card.vm.serverError).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
    expect(
      console.warn.mock.calls.filter(([message]) =>
        String(message).startsWith("[Vue warn]"),
      ),
    ).toEqual([]);
  });
});
