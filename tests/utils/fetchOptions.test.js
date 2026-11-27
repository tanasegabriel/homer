import { describe, expect, it } from "vitest";
import fetchOptions from "@/utils/fetchOptions.js";

describe("fetchOptions", () => {
  it("returns empty headers without any configuration", () => {
    expect(fetchOptions({})).toEqual({ headers: {} });
  });

  it("layers headers proxy, then item, then init, whatever their case", () => {
    const options = fetchOptions({
      proxy: { headers: { "X-Api-Key": "proxy", "X-Proxy": "p" } },
      item: { headers: { "x-api-key": "item", "X-Item": "i" } },
      init: { headers: { "X-API-KEY": "card" } },
    });

    expect(options.headers).toEqual({
      "x-api-key": "card",
      "x-proxy": "p",
      "x-item": "i",
    });
  });

  it("never lets an unset value replace a configured header", () => {
    const options = fetchOptions({
      item: { headers: { Authorization: "Basic abc" } },
      init: { headers: { authorization: undefined, "X-Empty": null } },
    });

    expect(options.headers).toEqual({ authorization: "Basic abc" });
  });

  it.each([
    [{}, {}, undefined],
    [{ useCredentials: true }, {}, "include"],
    [{}, { useCredentials: true }, "include"],
    [{ useCredentials: true }, { useCredentials: false }, "omit"],
    [{}, { useCredentials: false }, "omit"],
  ])("proxy %o and item %o give credentials %s", (proxy, item, expected) => {
    expect(fetchOptions({ proxy, item }).credentials).toBe(expected);
  });

  it("applies init last", () => {
    const options = fetchOptions({
      proxy: { useCredentials: true },
      init: { credentials: "same-origin", method: "POST", cache: "no-cache" },
    });

    expect(options).toEqual({
      credentials: "same-origin",
      method: "POST",
      cache: "no-cache",
      headers: {},
    });
  });

  it("does not modify its arguments", () => {
    const init = Object.freeze({
      method: "POST",
      headers: Object.freeze({ "X-Card": "1" }),
    });
    const item = Object.freeze({
      headers: Object.freeze({ "X-Item": "2" }),
    });

    expect(fetchOptions({ item, init }).headers).toEqual({
      "x-card": "1",
      "x-item": "2",
    });
    expect(init.headers).toEqual({ "X-Card": "1" });
  });
});
