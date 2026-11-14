import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/server/repositories/shared/prisma';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Makes `%`, `_` and the escape character itself match as themselves in Postgres `LIKE` (backslash is its default escape). */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const SELECT = {
  id: true,
  parentSku: true,
  translations: { select: { locale: true, name: true } },
  images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
  variants: { select: { modelSku: true }, orderBy: { position: 'asc' }, take: 1 },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof SELECT }>;

/** The Thai name, or any other; the SKU is the parent's, or the first variant's when the parent has none. */
function toHit(row: Row): ProductPickerHit {
  const name = row.translations.find((entry) => entry.locale === 'th') ?? row.translations[0];
  return {
    id: row.id,
    name: name?.name ?? '',
    sku: row.parentSku ?? row.variants[0]?.modelSku ?? '',
    imageUrl: row.images[0]?.url ?? null,
  };
}

/**
 * Active products whose name (either language) or SKU (the parent's or any variant's) contains `query`, ignoring case;
 * at most `limit`, by SKU. This is a read for
 * the news editor's product picker (R3): it changes nothing. Prisma does not escape `%` and `_` in `contains`, so they
 * are escaped here and the query is plain text.
 */
export async function searchActiveProducts(query: string, limit: number): Promise<ProductPickerHit[]> {
  const contains = { contains: escapeLike(query), mode: 'insensitive' } as const;
  const rows = await getPrisma().product.findMany({
    where: {
      isActive: true,
      OR: [
        { translations: { some: { name: contains } } },
        { parentSku: contains },
        { variants: { some: { modelSku: contains } } },
      ],
    },
    select: SELECT,
    orderBy: [{ parentSku: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  return rows.map(toHit);
}

/** The products named (active or not), for the picker's selected list; unknown or malformed ids are ignored. */
export async function findProductSummaries(ids: readonly string[]): Promise<ProductPickerHit[]> {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  const rows = await getPrisma().product.findMany({ where: { id: { in: valid } }, select: SELECT });
  const byId = new Map(rows.map((row) => [row.id, toHit(row)]));
  return valid.flatMap((id) => byId.get(id) ?? []);
}
