import { beforeEach, describe, expect, it } from "vitest";

import { categoriseProducts } from "@/server/repositories/catalogue/categorise-repository";
import { upsertCatalogueItem } from "@/server/repositories/catalogue/catalogue-repository";
import { getPrisma } from "@/server/repositories/shared/prisma";
import { resetDatabase } from "../setup/database";
import { noModelSnapshot } from "../fixtures/snapshots";

const T1 = new Date("2026-10-26T01:00:00.000Z");

async function seedProducts(): Promise<void> {
  await upsertCatalogueItem(
    noModelSnapshot({
      externalItemId: 1n,
      parentSku: "A",
      name: "Mario Kart - Nintendo Switch Game",
    }),
    T1,
  );
  await upsertCatalogueItem(
    noModelSnapshot({
      externalItemId: 2n,
      parentSku: "B",
      name: "DualSense Wireless Controller - PlayStation 5",
    }),
    T1,
  );
  await upsertCatalogueItem(
    noModelSnapshot({
      externalItemId: 3n,
      parentSku: "C",
      name: "Three Tier Limit Test",
    }),
    T1,
  );
}

async function productByName(name: string) {
  const translation = await getPrisma().productTranslation.findFirstOrThrow({
    where: { name, locale: "th" },
  });
  return getPrisma().product.findUniqueOrThrow({
    where: { id: translation.productId },
    include: {
      primaryCategory: true,
      categories: { include: { category: true } },
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("categoriseProducts", () => {
  it("seeds the category tree when missing", async () => {
    await categoriseProducts();

    const categories = await getPrisma().category.findMany({
      include: { translations: true, parent: true },
      orderBy: { slug: "asc" },
    });
    expect(categories).toHaveLength(12);
    const platforms = categories
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.position - b.position);
    expect(platforms.map((c) => c.slug)).toEqual([
      "nintendo-switch",
      "playstation-5",
      "it-gadgets",
    ]);
    const itAccessory = categories.find(
      (c) => c.slug === "it-gadgets-accessory",
    );
    expect(itAccessory?.parent?.slug).toBe("it-gadgets");
    const controller = categories.find(
      (c) => c.slug === "playstation-5-controller",
    );
    expect(
      controller?.translations.map((t) => [t.locale, t.name]).sort(),
    ).toEqual([
      ["en", "Controllers"],
      ["th", "จอย"],
    ]);
    const switchPlatform = categories.find((c) => c.slug === "nintendo-switch");
    expect(switchPlatform?.translations.map((t) => t.name).sort()).toEqual([
      "Nintendo Switch",
      "Nintendo Switch",
    ]);
  });

  it("only fills uncategorised products and is idempotent", async () => {
    await seedProducts();
    const prisma = getPrisma();
    // An admin-assigned product the categoriser must not touch.
    await upsertCatalogueItem(
      noModelSnapshot({
        externalItemId: 4n,
        parentSku: "D",
        name: "Pro Controller - Nintendo Switch",
      }),
      T1,
    );
    const adminTarget = await prisma.category.create({
      data: { slug: "admin-pick", position: 9 },
    });
    const adminProduct = await productByName(
      "Pro Controller - Nintendo Switch",
    );
    await prisma.product.update({
      where: { id: adminProduct.id },
      data: { primaryCategoryId: adminTarget.id },
    });

    expect(await categoriseProducts()).toEqual({ categorised: 2, skipped: 2 });

    const game = await productByName("Mario Kart - Nintendo Switch Game");
    expect(game.primaryCategory?.slug).toBe("nintendo-switch-game");
    expect(game.categories.map((c) => c.category.slug).sort()).toEqual([
      "nintendo-switch",
      "nintendo-switch-game",
    ]);
    const pad = await productByName(
      "DualSense Wireless Controller - PlayStation 5",
    );
    expect(pad.primaryCategory?.slug).toBe("playstation-5-controller");
    const none = await productByName("Three Tier Limit Test");
    expect(none.primaryCategoryId).toBeNull();
    expect(none.categories).toHaveLength(0);
    const untouched = await productByName("Pro Controller - Nintendo Switch");
    expect(untouched.primaryCategoryId).toBe(adminTarget.id);
    expect(untouched.categories).toHaveLength(0);

    const links = await prisma.productCategory.count();
    expect(await categoriseProducts()).toEqual({ categorised: 0, skipped: 4 });
    expect(await prisma.productCategory.count()).toBe(links);
    expect(await prisma.category.count()).toBe(12 + 1);
  });

  it('leaves a product that has a category link but no primary category untouched', async () => {
    const prisma = getPrisma();
    await upsertCatalogueItem(noModelSnapshot({ externalItemId: 5n, parentSku: 'E', name: 'Mario Kart - Nintendo Switch Game' }), T1);
    const target = await prisma.category.create({ data: { slug: 'admin-pick', position: 9 } });
    const product = await productByName('Mario Kart - Nintendo Switch Game');
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: target.id } });

    expect(await categoriseProducts()).toEqual({ categorised: 0, skipped: 1 });
    const after = await productByName('Mario Kart - Nintendo Switch Game');
    expect(after.primaryCategoryId).toBeNull();
    expect(after.categories.map((c) => c.category.slug)).toEqual(['admin-pick']);
  });

  it('categorises 300 products in one run', async () => {
    for (let i = 0; i < 300; i += 1) {
      await upsertCatalogueItem(
        noModelSnapshot({ externalItemId: BigInt(1000 + i), parentSku: `BULK-${i}`, name: `Bulk Game ${i} - Nintendo Switch Game` }),
        T1,
      );
    }
    expect(await categoriseProducts()).toEqual({ categorised: 300, skipped: 0 });
    expect(await getPrisma().productCategory.count()).toBe(600);
  });
});
