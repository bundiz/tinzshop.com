import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/server/repositories/shared/prisma';
import type { Locale, StorefrontCandidate } from '@/server/services/catalogue/landing-catalogue-service';
import type { StorefrontProductRow } from '@/server/services/catalogue/product-detail-service';
import type {
  StorefrontCategory,
  StorefrontListingFacetCounts,
  StorefrontListingFilter,
  StorefrontListingPage,
  StorefrontListingSort,
} from '@/server/services/catalogue/storefront-listing-service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every product the storefront may show (spec 2026-10-26 §5.3, applied in SQL): active, its Shopee item
 * NORMAL, and at least one active variant. Each row carries what the listing filters and sorts on, the
 * price and stock taken from the active variants only: `min_price` is the cheapest active variant (sold
 * out or not) and `in_stock` is whether any active variant has stock; the inner join on the grouped active
 * variants is the "at least one active variant" rule. A grouped subquery, not a lateral join, because
 * every listing, facet and landing query aggregates the whole visible set: one pass over `variant` beats
 * a lookup per product (EXPLAIN, plan 013 Task 3, D-147). Used as `FROM (...) b`.
 */
const VISIBLE_PRODUCTS = Prisma.sql`
  SELECT p.id, p.is_pre_order, p.release_date, ci.is_kit, ci.sales_count, ci.external_created_at,
         v.min_price, v.in_stock
  FROM product p
  JOIN channel_item ci ON ci.product_id = p.id
  JOIN (
    SELECT variant.product_id, MIN(variant.price_satang) AS min_price,
           BOOL_OR(variant.stock_quantity > 0) AS in_stock
    FROM variant
    WHERE variant.is_active
    GROUP BY variant.product_id
  ) v ON v.product_id = p.id
  WHERE p.is_active AND ci.external_status = 'NORMAL'`;

const CANDIDATE_INCLUDE = {
  translations: true,
  images: { where: { position: 0 }, take: 1 },
  channelItem: true,
  variants: true,
} satisfies Prisma.ProductInclude;

type CandidateRow = Prisma.ProductGetPayload<{ include: typeof CANDIDATE_INCLUDE }>;

function toCandidate(row: CandidateRow): StorefrontCandidate {
  return {
    productId: row.id,
    isActive: row.isActive,
    externalStatus: row.channelItem?.externalStatus ?? '',
    names: Object.fromEntries(row.translations.map((t) => [t.locale, t.name])),
    imageUrl: row.images[0]?.url ?? null,
    isKit: row.channelItem?.isKit ?? false,
    salesCount: row.channelItem?.salesCount ?? null,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    variants: row.variants.map((v) => ({
      priceSatang: v.priceSatang,
      originalPriceSatang: v.originalPriceSatang,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
    })),
  };
}

/** The cards' data for these product ids, in the order given. */
async function loadCandidates(ids: string[]): Promise<StorefrontCandidate[]> {
  if (ids.length === 0) return [];
  const rows = await getPrisma().product.findMany({ where: { id: { in: ids } }, include: CANDIDATE_INCLUDE });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [toCandidate(row)];
  });
}

/**
 * The landing page's products (plan 013): the 8 best sellers, the 6 best-selling kits and the 4 soonest
 * pre-orders, each sorted and limited in SQL, as one de-duplicated list of at most 18. Ties break by the
 * locale's name (as `pickProductName` picks it) under the database collation, then id, so the read stays
 * bounded and deterministic; at a cutoff tie this may pick a different product than JS `localeCompare`
 * would (ruling R4, D-147). The service builds the sections from these rows with its own sort.
 */
export async function listStorefrontCandidates(locale: Locale = 'th'): Promise<StorefrontCandidate[]> {
  const name =
    locale === 'en'
      ? Prisma.sql`COALESCE(NULLIF(en.name, ''), th.name, en.name, '')`
      : Prisma.sql`COALESCE(th.name, en.name, '')`;
  const rows = await getPrisma().$queryRaw<{ id: string }[]>`
    WITH named AS (
      SELECT b.*, ${name} AS name
      FROM (${VISIBLE_PRODUCTS}) b
      LEFT JOIN product_translation th ON th.product_id = b.id AND th.locale = 'th'
      LEFT JOIN product_translation en ON en.product_id = b.id AND en.locale = 'en'
    )
    (SELECT id FROM named ORDER BY sales_count DESC NULLS LAST, name, id LIMIT 8)
    UNION
    (SELECT id FROM named WHERE is_kit ORDER BY sales_count DESC NULLS LAST, name, id LIMIT 6)
    UNION
    (SELECT id FROM named WHERE is_pre_order
     ORDER BY release_date ASC NULLS LAST, sales_count DESC NULLS LAST, name, id LIMIT 4)`;
  return loadCandidates(rows.map((row) => row.id));
}

/** Every category (platforms and product types) with its names, for validating and labelling the listing. */
export async function listStorefrontCategories(): Promise<StorefrontCategory[]> {
  const rows = await getPrisma().category.findMany({ include: { translations: true } });
  return rows.map(toStorefrontCategory);
}

function toStorefrontCategory(
  row: Prisma.CategoryGetPayload<{ include: { translations: true } }>,
): StorefrontCategory {
  return {
    id: row.id,
    slug: row.slug,
    parentId: row.parentId,
    position: row.position,
    names: Object.fromEntries(row.translations.map((t) => [t.locale, t.name])),
  };
}

const TRUE = Prisma.sql`TRUE`;

function inCategories(ids: string[]): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM product_category pc
    WHERE pc.product_id = b.id
      AND pc.category_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}))`;
}

/** One condition per filter dimension over `b` (a `VISIBLE_PRODUCTS` row); an inactive one is TRUE. */
function dimensions(filter: StorefrontListingFilter) {
  const bounds = [
    filter.minSatang === null ? null : Prisma.sql`b.min_price >= ${filter.minSatang}`,
    filter.maxSatang === null ? null : Prisma.sql`b.min_price <= ${filter.maxSatang}`,
  ].filter((bound) => bound !== null);
  return {
    category: filter.categoryId === null ? TRUE : inCategories([filter.categoryId]),
    // Several types match any of them; every dimension ANDs with the others.
    type: filter.typeIds.length === 0 ? TRUE : inCategories(filter.typeIds),
    // The platform facet's type dimension: the chosen kinds on every platform (D-148).
    typeByKind: filter.categoryFacetTypeIds.length === 0 ? TRUE : inCategories(filter.categoryFacetTypeIds),
    price: bounds.length === 0 ? TRUE : Prisma.join(bounds, ' AND '),
    inStock: filter.inStock ? Prisma.sql`b.in_stock` : TRUE,
    kit: filter.kit ? Prisma.sql`b.is_kit` : TRUE,
    preOrder: filter.preOrder ? Prisma.sql`b.is_pre_order` : TRUE,
  };
}

/** Fixed fragments only; every sort ends on `b.id`, so pages never overlap (D-144). */
const ORDER_BY: Record<StorefrontListingSort, Prisma.Sql> = {
  recommended: Prisma.sql`b.in_stock DESC, b.sales_count DESC, b.id`,
  best_selling: Prisma.sql`b.sales_count DESC, b.id`,
  newest: Prisma.sql`b.external_created_at DESC, b.id`,
  price_asc: Prisma.sql`b.min_price ASC, b.id`,
  price_desc: Prisma.sql`b.min_price DESC, b.id`,
};

/** One page of the listing with every filter, the sort and the paging in SQL, plus the total matched. */
export async function listStorefrontProducts(filter: StorefrontListingFilter): Promise<StorefrontListingPage> {
  const d = dimensions(filter);
  const where = Prisma.join([d.category, d.type, d.price, d.inStock, d.kit, d.preOrder], ' AND ');
  const offset = (filter.page - 1) * filter.pageSize;
  const rows = await getPrisma().$queryRaw<{ id: string; total: bigint }[]>`
    SELECT b.id::text AS id, COUNT(*) OVER () AS total
    FROM (${VISIBLE_PRODUCTS}) b
    WHERE ${where}
    ORDER BY ${ORDER_BY[filter.sort]}
    LIMIT ${filter.pageSize} OFFSET ${offset}`;
  let total = Number(rows[0]?.total ?? 0);
  if (rows.length === 0 && offset > 0) {
    // Past the end the window has no row to report on; the service needs the total to answer 404.
    const [counted] = await getPrisma().$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM (${VISIBLE_PRODUCTS}) b WHERE ${where}`;
    total = Number(counted?.total ?? 0);
  }
  return { rows: await loadCandidates(rows.map((row) => row.id)), total };
}

/**
 * The facet counts in one query (R1): each applies every active filter except its own dimension. The
 * platform facet matches the type dimension by kind (`categoryFacetTypeIds`, D-148), since choosing a
 * platform carries the chosen kinds over to its types; every other facet applies the types as chosen. A product
 * counts once per category, since `product_category` holds one row per (product, category), so linking a
 * product to its platform and its type never counts it twice in either.
 */
export async function countStorefrontFacets(filter: StorefrontListingFilter): Promise<StorefrontListingFacetCounts> {
  const d = dimensions(filter);
  const rows = await getPrisma().$queryRaw<{ facet: string; key: string | null; count: number }[]>`
    WITH flagged AS (
      SELECT b.id, b.in_stock, b.is_kit, b.is_pre_order,
             (${d.category}) AS m_category, (${d.type}) AS m_type, (${d.typeByKind}) AS m_type_kind,
             (${d.price}) AS m_price,
             (${d.inStock}) AS m_in_stock, (${d.kit}) AS m_kit, (${d.preOrder}) AS m_pre_order
      FROM (${VISIBLE_PRODUCTS}) b
    )
    SELECT 'category' AS facet, c.id::text AS key, COUNT(*)::int AS count
    FROM flagged f
    JOIN product_category pc ON pc.product_id = f.id
    JOIN category c ON c.id = pc.category_id AND c.parent_id IS NULL
    WHERE f.m_type_kind AND f.m_price AND f.m_in_stock AND f.m_kit AND f.m_pre_order
    GROUP BY c.id
    UNION ALL
    SELECT 'type', c.id::text, COUNT(*)::int
    FROM flagged f
    JOIN product_category pc ON pc.product_id = f.id
    JOIN category c ON c.id = pc.category_id AND c.parent_id IS NOT NULL
    WHERE f.m_category AND f.m_price AND f.m_in_stock AND f.m_kit AND f.m_pre_order
    GROUP BY c.id
    UNION ALL
    SELECT 'in_stock', NULL,
           COUNT(*) FILTER (WHERE f.in_stock AND f.m_category AND f.m_type AND f.m_price AND f.m_kit AND f.m_pre_order)::int
    FROM flagged f
    UNION ALL
    SELECT 'kit', NULL,
           COUNT(*) FILTER (WHERE f.is_kit AND f.m_category AND f.m_type AND f.m_price AND f.m_in_stock AND f.m_pre_order)::int
    FROM flagged f
    UNION ALL
    SELECT 'pre_order', NULL,
           COUNT(*) FILTER (WHERE f.is_pre_order AND f.m_category AND f.m_type AND f.m_price AND f.m_in_stock AND f.m_kit)::int
    FROM flagged f`;
  const counts: StorefrontListingFacetCounts = {
    categories: new Map(),
    types: new Map(),
    inStock: 0,
    kit: 0,
    preOrder: 0,
  };
  for (const row of rows) {
    if (row.facet === 'category' && row.key !== null) counts.categories.set(row.key, row.count);
    else if (row.facet === 'type' && row.key !== null) counts.types.set(row.key, row.count);
    else if (row.facet === 'in_stock') counts.inStock = row.count;
    else if (row.facet === 'kit') counts.kit = row.count;
    else if (row.facet === 'pre_order') counts.preOrder = row.count;
  }
  return counts;
}

/**
 * One product with everything the product page shows, or `null` when the id is unknown.
 * A malformed id is `null` without a query: Postgres would reject it as a uuid.
 * The visibility rule is the service's to apply; this returns hidden products too.
 */
export async function findStorefrontProduct(productId: string): Promise<StorefrontProductRow | null> {
  if (!UUID.test(productId)) return null;
  const row = await getPrisma().product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      images: { orderBy: { position: 'asc' } },
      optionTypes: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
      variants: { orderBy: { position: 'asc' }, include: { optionValues: true } },
      channelItem: { select: { externalStatus: true, isKit: true } },
      categories: {
        include: { category: { include: { translations: true, parent: { include: { translations: true } } } } },
      },
    },
  });
  if (row === null) return null;
  // The linked categories and each one's parent, once each: the service picks the breadcrumb from them.
  const categories = new Map<string, StorefrontCategory>();
  for (const { category } of row.categories) {
    for (const entry of [category, category.parent]) {
      if (entry !== null && !categories.has(entry.id)) categories.set(entry.id, toStorefrontCategory(entry));
    }
  }
  return {
    productId: row.id,
    isActive: row.isActive,
    externalStatus: row.channelItem?.externalStatus ?? '',
    names: Object.fromEntries(row.translations.map((t) => [t.locale, t.name])),
    descriptions: Object.fromEntries(row.translations.map((t) => [t.locale, t.description])),
    brandName: row.brandName,
    shippingSizeTier: row.shippingSizeTier,
    isKit: row.channelItem?.isKit ?? false,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    images: row.images.map((image) => ({ url: image.url, position: image.position })),
    optionTypes: row.optionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      position: type.position,
      values: type.values.map((value) => ({ id: value.id, value: value.value, position: value.position })),
    })),
    variants: row.variants.map((v) => ({
      variantId: v.id,
      position: v.position,
      priceSatang: v.priceSatang,
      originalPriceSatang: v.originalPriceSatang,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
      optionValueIds: v.optionValues.map((link) => link.optionValueId),
    })),
    primaryCategoryId: row.primaryCategoryId,
    categories: [...categories.values()],
  };
}
