/**
 * The keyword categoriser (plan 013, D-143): a pure function from a product's Thai name to a
 * platform and a product type. Every word the owner may want to edit is in the constants below.
 * No framework, no database.
 */

export type ProductTypeKey = "console" | "game" | "controller" | "accessory";

export type CategoryNode = {
  slug: string;
  position: number;
  th: string;
  en: string;
};
export type PlatformNode = CategoryNode & {
  types: (CategoryNode & { type: ProductTypeKey })[];
};

const TYPE_NAMES: Record<ProductTypeKey, { th: string; en: string }> = {
  console: { th: "เครื่องเกม", en: "Consoles" },
  game: { th: "แผ่นเกม", en: "Games" },
  controller: { th: "จอย", en: "Controllers" },
  accessory: { th: "อุปกรณ์เสริม", en: "Accessories" },
};

function platform(
  slug: string,
  position: number,
  th: string,
  en: string,
  types: readonly ProductTypeKey[],
): PlatformNode {
  return {
    slug,
    position,
    th,
    en,
    types: types.map((type, index) => ({
      type,
      slug: `${slug}-${type}`,
      position: index + 1,
      ...TYPE_NAMES[type],
    })),
  };
}

const ALL_TYPES: readonly ProductTypeKey[] = [
  "console",
  "game",
  "controller",
  "accessory",
];

/** The category tree the categorise job seeds if missing, in the design's order. */
export const CATEGORY_TREE: readonly PlatformNode[] = [
  platform(
    "nintendo-switch",
    1,
    "Nintendo Switch",
    "Nintendo Switch",
    ALL_TYPES,
  ),
  platform("playstation-5", 2, "PlayStation 5", "PlayStation 5", ALL_TYPES),
  platform("it-gadgets", 3, "IT Gadgets", "IT Gadgets", ["accessory"]),
];

/**
 * The keyword tables, matched case-insensitively against the name; the first row that matches wins.
 * PlayStation words come before Switch words, so a DualSense is never mistaken for a Switch product.
 */
export const CATEGORISE_RULES = {
  platforms: [
    { slug: "playstation-5", words: ["ps5", "playstation", "dualsense"] },
    { slug: "nintendo-switch", words: ["switch", "nintendo"] },
    {
      slug: "it-gadgets",
      words: [
        "ssd",
        "keyboard",
        "mouse",
        "headset",
        "คีย์บอร์ด",
        "เมาส์",
        "หูฟัง",
      ],
    },
  ],
  types: [
    {
      type: "controller",
      words: ["controller", "จอย", "dualsense", "joy-con"],
      notWords: [],
    },
    { type: "console", words: ["console", "เครื่อง"], notWords: ["game"] },
    { type: "game", words: ["game", "เกม"], notWords: [] },
  ],
} as const;

export type Categorisation = { platformSlug: string; typeSlug: string };

function includesAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

/** Returns the platform and type slugs for a name, or null when no platform keyword matches. */
export function categoriseByName(name: string): Categorisation | null {
  const text = name.toLowerCase();
  const platformRule = CATEGORISE_RULES.platforms.find((rule) =>
    includesAny(text, rule.words),
  );
  if (!platformRule) return null;

  const platformNode = CATEGORY_TREE.find(
    (node) => node.slug === platformRule.slug,
  );
  const typeRule = CATEGORISE_RULES.types.find(
    (rule) =>
      includesAny(text, rule.words) && !includesAny(text, rule.notWords),
  );
  const type: ProductTypeKey = typeRule?.type ?? "accessory";
  // A platform without that type (IT Gadgets has only accessories) falls back to accessory.
  const typeNode =
    platformNode?.types.find((node) => node.type === type) ??
    platformNode?.types.find((node) => node.type === "accessory");
  if (!typeNode) return null;
  return { platformSlug: platformRule.slug, typeSlug: typeNode.slug };
}
