import {
  CATEGORY_TREE,
  categoriseByName,
} from "@/server/services/catalogue/categorise-by-name";
import { getPrisma } from "@/server/repositories/shared/prisma";

/**
 * Development aid until admins can assign categories (D-143): seeds the category tree if missing,
 * then gives every product with no category (no `product_category` row and no `primary_category_id`)
 * its type as primary category plus a row for the type and its platform. Never touches an
 * already-categorised product, so a re-run changes nothing. `skipped` is every other product.
 */
export async function categoriseProducts(): Promise<{
  categorised: number;
  skipped: number;
}> {
  return getPrisma().$transaction(async (tx) => {
    const idBySlug = new Map<string, string>();
    for (const platform of CATEGORY_TREE) {
      const nodes = [
        { ...platform, parentSlug: null as string | null },
        ...platform.types.map((t) => ({
          ...t,
          parentSlug: platform.slug as string | null,
        })),
      ];
      for (const node of nodes) {
        const parentId =
          node.parentSlug === null
            ? null
            : (idBySlug.get(node.parentSlug) ?? null);
        // An existing row (maybe edited by an admin) is left as it is.
        const row = await tx.category.upsert({
          where: { slug: node.slug },
          create: { slug: node.slug, position: node.position, parentId },
          update: {},
        });
        idBySlug.set(node.slug, row.id);
        await tx.categoryTranslation.createMany({
          data: [
            { categoryId: row.id, locale: "th", name: node.th },
            { categoryId: row.id, locale: "en", name: node.en },
          ],
          skipDuplicates: true,
        });
      }
    }

    const total = await tx.product.count();
    const candidates = await tx.product.findMany({
      where: { primaryCategoryId: null, categories: { none: {} } },
      select: {
        id: true,
        translations: { where: { locale: "th" }, select: { name: true } },
      },
    });

    let categorised = 0;
    for (const product of candidates) {
      const name = product.translations[0]?.name;
      const result = name === undefined ? null : categoriseByName(name);
      if (!result) continue;
      const typeId = idBySlug.get(result.typeSlug);
      const platformId = idBySlug.get(result.platformSlug);
      if (!typeId || !platformId) continue;
      await tx.product.update({
        where: { id: product.id },
        data: { primaryCategoryId: typeId },
      });
      await tx.productCategory.createMany({
        data: [
          { productId: product.id, categoryId: typeId },
          { productId: product.id, categoryId: platformId },
        ],
        skipDuplicates: true,
      });
      categorised += 1;
    }
    return { categorised, skipped: total - categorised };
  });
}
