import { describe, expect, it, vi } from "vitest";
import {
  capCount,
  displayCount,
  displayDuration,
  displayLatency,
  displayPercent,
  displayRate,
  displaySize,
  displayTemperature,
  displayVersion,
} from "@/utils/format.js";

describe("capCount", () => {
  it("caps numbers above the ceiling", () => {
    expect(capCount(99)).toBe(99);
    expect(capCount(100)).toBe("99+");
    expect(capCount(501, 500)).toBe("500+");
  });

  it("leaves anything else untouched", () => {
    expect(capCount("100")).toBe("100");
    expect(capCount(null)).toBe(null);
  });
});

describe("displayCount", () => {
  it("picks the singular or the plural", () => {
    expect(displayCount(1, "message")).toBe("1 message");
    expect(displayCount(0, "message")).toBe("0 messages");
    expect(displayCount(2, "entry", "entries")).toBe("2 entries");
    expect(displayCount("99+", "message")).toBe("99+ messages");
  });
});

describe("displayVersion", () => {
  it("labels a version and drops an empty one", () => {
    expect(displayVersion("1.2.3")).toBe("Version 1.2.3");
    expect(displayVersion("")).toBe(null);
    expect(displayVersion(undefined)).toBe(null);
  });
});

describe("numeric labels", () => {
  it("formats finite numbers", () => {
    expect(displayPercent(12.345)).toBe("12.3%");
    expect(displayPercent(12.345, 0)).toBe("12%");
    expect(displayLatency(12.34)).toBe("12.3 ms");
    expect(displayTemperature(41.26)).toBe("41.3 °C");
    expect(displayTemperature(100, "°F", 0)).toBe("100 °F");
  });

  it("returns null for anything that is not a finite number", () => {
    for (const value of [null, undefined, NaN, Infinity, "12"]) {
      expect(displayPercent(value)).toBe(null);
      expect(displayLatency(value)).toBe(null);
      expect(displayTemperature(value)).toBe(null);
    }
  });
});

describe("displayRate", () => {
  it("scales bytes per second by thousands", () => {
    const NumberFormat = Intl.NumberFormat;
    vi.spyOn(Intl, "NumberFormat").mockImplementation(
      (_locale, options) => new NumberFormat("en-US", options),
    );

    expect(displayRate(undefined)).toBe("0 B/s");
    expect(displayRate(999)).toBe("999 B/s");
    expect(displayRate(1500)).toBe("1.5 KB/s");
    expect(displayRate(1234567)).toBe("1.23 MB/s");
    expect(displayRate(5e15)).toBe("5,000 TB/s");
  });
});

describe("displaySize", () => {
  it("scales bytes by 1024", () => {
    expect(displaySize(512)).toBe("512 B");
    expect(displaySize(1536)).toBe("1.50 KiB");
    expect(displaySize(1024 ** 2)).toBe("1.00 MiB");
    expect(displaySize(1024 ** 5)).toBe("1024.00 TiB");
  });

  it("moves up a unit instead of showing 1024.00", () => {
    expect(displaySize(1024 ** 2 - 1)).toBe("1.00 MiB");
  });
});

describe("displayDuration", () => {
  it("drops the units that are zero at the top", () => {
    expect(displayDuration(45)).toBe("45 seconds");
    expect(displayDuration(125)).toBe("02m 05s");
    expect(displayDuration(3725)).toBe("01h 02m 05s");
    expect(displayDuration(90061)).toBe("1d 01h 01m");
  });
});
