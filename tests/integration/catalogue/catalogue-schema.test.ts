import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '@/server/config';
import { resetDatabase } from '../setup/database';

let client: Client;

async function insertProduct(): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO product DEFAULT VALUES RETURNING id',
  );
  return result.rows[0]!.id;
}

async function insertChannelItem(productId: string, externalItemId: bigint = 1n): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO channel_item (product_id, channel, external_item_id, external_status, external_category_id,
       is_kit, external_created_at, external_updated_at, sales_count, rating_star, rating_count, last_synced_at, raw_payload)
     VALUES ($1, 'shopee', $2, 'NORMAL', 1, false, now(), now(), 0, 0, 0, now(), '{}'::jsonb) RETURNING id`,
    [productId, externalItemId.toString()],
  );
  return result.rows[0]!.id;
}

async function insertVariant(productId: string, stock = 1): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO variant (product_id, price_satang, original_price_satang, stock_quantity, is_active, position)
     VALUES ($1, 100, 100, $2, true, 0) RETURNING id`,
    [productId, stock],
  );
  return result.rows[0]!.id;
}

async function insertListing(
  variantId: string,
  channelItemId: string,
  externalModelId: bigint | null,
): Promise<void> {
  await client.query(
    `INSERT INTO channel_listing (variant_id, channel_item_id, external_model_id, last_synced_at)
     VALUES ($1, $2, $3, now())`,
    [variantId, channelItemId, externalModelId === null ? null : externalModelId.toString()],
  );
}

describe('catalogue schema constraints', () => {
  beforeEach(async () => {
    await resetDatabase();
    client = new Client({ connectionString: getDatabaseUrl() });
    await client.connect();
  });

  afterEach(async () => {
    await client.end();
  });

  it('rejects negative stock', async () => {
    const productId = await insertProduct();
    await insertVariant(productId, 5);
    await expect(client.query('UPDATE variant SET stock_quantity = -1')).rejects.toThrow(
      /variant_stock_quantity_non_negative/,
    );
  });

  it('rejects a second no-model listing for the same item', async () => {
    const productId = await insertProduct();
    const itemId = await insertChannelItem(productId);
    const v1 = await insertVariant(productId);
    const v2 = await insertVariant(productId);
    await insertListing(v1, itemId, null);
    await expect(insertListing(v2, itemId, null)).rejects.toThrow(/channel_listing_item_model_key/);
  });

  it('allows distinct model ids for the same item', async () => {
    const productId = await insertProduct();
    const itemId = await insertChannelItem(productId);
    const v1 = await insertVariant(productId);
    const v2 = await insertVariant(productId);
    await insertListing(v1, itemId, 1n);
    await expect(insertListing(v2, itemId, 2n)).resolves.toBeUndefined();
  });

  it('rejects a channel other than shopee', async () => {
    const productId = await insertProduct();
    await expect(
      client.query(
        `INSERT INTO channel_item (product_id, channel, external_item_id, external_status, external_category_id,
           is_kit, external_created_at, external_updated_at, sales_count, rating_star, rating_count, last_synced_at, raw_payload)
         VALUES ($1, 'lazada', 1, 'NORMAL', 1, false, now(), now(), 0, 0, 0, now(), '{}'::jsonb)`,
        [productId],
      ),
    ).rejects.toThrow(/channel_item_channel_known/);
  });

  it('stores int64 ids exactly', async () => {
    const productId = await insertProduct();
    await insertChannelItem(productId, 9007199254740993n);
    const result = await client.query<{ external_item_id: string }>(
      'SELECT external_item_id FROM channel_item',
    );
    expect(BigInt(result.rows[0]!.external_item_id)).toBe(9007199254740993n);
  });
});
