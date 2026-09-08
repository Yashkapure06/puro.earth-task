import { describe, expect, it } from "vitest";
import { formatMoney, parseMajorToMinor, parsePositiveMinorUnits } from "./money";

describe("money utilities", () => {
  it("formats minor units as GBP", () => {
    expect(formatMoney(428_050)).toBe("£4,280.50");
    expect(formatMoney(100)).toBe("£1.00");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("formats signed amounts", () => {
    expect(formatMoney(25_000, "GBP", { signed: true })).toBe("+£250.00");
    expect(formatMoney(-10_000, "GBP", { signed: true })).toBe("−£100.00");
  });

  it("parses major-unit input to minor units without floats", () => {
    expect(parseMajorToMinor("250.00")).toBe(25_000);
    expect(parseMajorToMinor("4,280.50")).toBe(428_050);
    expect(parseMajorToMinor("£10.5")).toBe(1_050);
    expect(parseMajorToMinor("0.01")).toBe(1);
    expect(parseMajorToMinor("abc")).toBeNull();
    expect(parseMajorToMinor("10.999")).toBeNull();
  });

  it("rejects zero, empty, and invalid input for mutations", () => {
    expect(parsePositiveMinorUnits("10.50")).toBe(1_050);
    expect(parsePositiveMinorUnits("0")).toBeNull();
    expect(parsePositiveMinorUnits("0.00")).toBeNull();
    expect(parsePositiveMinorUnits("")).toBeNull();
    expect(parsePositiveMinorUnits("abc")).toBeNull();
  });
});
