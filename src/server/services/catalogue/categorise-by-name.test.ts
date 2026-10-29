import { describe, expect, it } from "vitest";

import { CATEGORISE_RULES, CATEGORY_TREE, categoriseByName } from "./categorise-by-name";

describe("categoriseByName", () => {
  it.each([
    [
      "[SANDBOX] DualSense Wireless Controller - PlayStation 5",
      "playstation-5",
      "playstation-5-controller",
    ],
    [
      "[SANDBOX] Portable SSD USB-C - IT Gadget",
      "it-gadgets",
      "it-gadgets-accessory",
    ],
    [
      "[SANDBOX] Mario Kart 8 Deluxe - Nintendo Switch Game",
      "nintendo-switch",
      "nintendo-switch-game",
    ],
    [
      "[SANDBOX] Zelda Tears of the Kingdom - Nintendo Switch Game",
      "nintendo-switch",
      "nintendo-switch-game",
    ],
    [
      "Tinzshop Sandbox Test Item - Nintendo Switch Game",
      "nintendo-switch",
      "nintendo-switch-game",
    ],
    [
      "[SANDBOX] Upcoming Release Pre-Order - Nintendo Switch Game",
      "nintendo-switch",
      "nintendo-switch-game",
    ],
    [
      "Servage Raven Case for Nintendo Switch 2",
      "nintendo-switch",
      "nintendo-switch-accessory",
    ],
    ["PlayStation 5 Console Slim", "playstation-5", "playstation-5-console"],
    ["เครื่อง PS5 Slim", "playstation-5", "playstation-5-console"],
    [
      "Joy-Con Pair - Nintendo Switch",
      "nintendo-switch",
      "nintendo-switch-controller",
    ],
    ["Gaming Mouse RGB", "it-gadgets", "it-gadgets-accessory"],
    ["คีย์บอร์ดเกมมิ่ง", "it-gadgets", "it-gadgets-accessory"],
    ["ps5 charging dock", "playstation-5", "playstation-5-accessory"],
  ])("%s -> %s / %s", (name, platform, type) => {
    expect(categoriseByName(name)).toEqual({
      platformSlug: platform,
      typeSlug: type,
    });
  });

  it("gives no category when no platform keyword matches", () => {
    expect(
      categoriseByName("[SANDBOX] Three Tier Limit Test - Not For Sale"),
    ).toBeNull();
    expect(categoriseByName("")).toBeNull();
  });

  it("puts every produced slug in the category tree", () => {
    const slugs = new Set(
      CATEGORY_TREE.flatMap((p) => [p.slug, ...p.types.map((t) => t.slug)]),
    );
    expect(slugs).toContain("it-gadgets-accessory");
    expect(slugs).not.toContain("it-gadgets-game");
    expect(CATEGORY_TREE.map((p) => p.slug)).toEqual([
      "nintendo-switch",
      "playstation-5",
      "it-gadgets",
    ]);
  });

  it('prefers PlayStation over Switch when a name has both', () => {
    expect(categoriseByName('Switch Dock for PS5')?.platformSlug).toBe('playstation-5');
  });

  it('calls a name with Console and Game a game, not a console', () => {
    expect(categoriseByName('Console Game Bundle - Nintendo Switch')?.typeSlug).toBe('nintendo-switch-game');
  });

  it('has every rule slug in the tree', () => {
    const platforms = new Set(CATEGORY_TREE.map((p) => p.slug));
    for (const rule of CATEGORISE_RULES.platforms) expect(platforms).toContain(rule.slug);
    const types = new Set(CATEGORY_TREE.flatMap((p) => p.types.map((t) => t.type)));
    for (const rule of CATEGORISE_RULES.types) expect(types).toContain(rule.type);
  });
});
