import { describe, expect, it } from "vitest";
import { bahtToSatang } from "@/server/services/shared/money";

describe("bahtToSatang", () => {
  it.each([
    [1590, 159000n],
    [2990, 299000n],
    [133.33, 13333n],
    [19.99, 1999n],
    [0.1 + 0.2, 30n],
    [0, 0n],
  ])("converts baht to satang: %s -> %s", (baht, satang) => {
    expect(bahtToSatang(baht)).toBe(satang);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1.234])(
    "rejects impossible amounts: %s",
    (baht) => {
      expect(() => bahtToSatang(baht)).toThrow(RangeError);
    },
  );
});
