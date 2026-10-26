// THROWAWAY SPIKE. Reads products, variants and recent orders back from the Shopee SANDBOX
// shop and saves the raw responses, so the database can be designed against real shapes.
// Usage: npm run shopee:dump

import { callShop, runMain, writeState } from './lib.mjs';

const ITEM_STATUSES = ['NORMAL', 'UNLIST'];
const PAGE_SIZE = 50;
const BASE_INFO_BATCH = 50;
// Shopee's order list takes a bounded time window; 15 days is the range used here.
const ORDER_WINDOW_SECONDS = 15 * 24 * 60 * 60;
const ORDER_OPTIONAL_FIELDS = [
  'item_list',
  'package_list',
  'total_amount',
  'payment_method',
  'shipping_carrier',
  'pay_time',
  'recipient_address',
];

async function listItemIds() {
  const items = [];
  let offset = 0;
  for (;;) {
    const page = await callShop('GET', '/api/v2/product/get_item_list', {
      query: { offset, page_size: PAGE_SIZE, item_status: ITEM_STATUSES },
    });
    items.push(...(page.response.item ?? []));
    if (!page.response.has_next_page) return items;
    offset = page.response.next_offset ?? offset + PAGE_SIZE;
  }
}

async function baseInfo(itemIds) {
  const infos = [];
  for (let start = 0; start < itemIds.length; start += BASE_INFO_BATCH) {
    const batch = itemIds.slice(start, start + BASE_INFO_BATCH);
    const page = await callShop('GET', '/api/v2/product/get_item_base_info', {
      query: { item_id_list: batch.join(',') },
    });
    infos.push(...(page.response.item_list ?? []));
  }
  return infos;
}

async function modelLists(infos) {
  const models = {};
  for (const info of infos) {
    if (!info.has_model) continue;
    const page = await callShop('GET', '/api/v2/product/get_model_list', {
      query: { item_id: info.item_id },
    });
    models[info.item_id] = page.response;
  }
  return models;
}

async function recentOrders() {
  const timeTo = Math.floor(Date.now() / 1000);
  const list = await callShop('GET', '/api/v2/order/get_order_list', {
    query: {
      time_range_field: 'create_time',
      time_from: timeTo - ORDER_WINDOW_SECONDS,
      time_to: timeTo,
      page_size: PAGE_SIZE,
    },
  });
  const orderSns = (list.response.order_list ?? []).map((order) => order.order_sn);
  if (orderSns.length === 0) return { list: list.response, details: [] };

  const detail = await callShop('GET', '/api/v2/order/get_order_detail', {
    query: {
      order_sn_list: orderSns.join(','),
      response_optional_fields: ORDER_OPTIONAL_FIELDS.join(','),
    },
  });
  return { list: list.response, details: detail.response.order_list ?? [] };
}

// Each section is captured on its own, so one unsupported call does not lose the rest.
async function capture(label, task) {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    console.error(`  ${label} failed: ${error.message}`);
    return { ok: false, error: error.shopeeResponse ?? error.message };
  }
}

runMain(async () => {
  const items = await capture('get_item_list', listItemIds);
  const itemIds = items.ok ? items.data.map((item) => item.item_id) : [];
  const infos = await capture('get_item_base_info', () => baseInfo(itemIds));
  const models = await capture('get_model_list', () => modelLists(infos.ok ? infos.data : []));
  const orders = await capture('get_order_list/detail', recentOrders);

  const dump = { capturedAt: new Date().toISOString(), items, infos, models, orders };
  const file = await writeState(`dump-${Date.now()}.json`, dump);

  console.log(`items: ${itemIds.length}`);
  console.log(`items with variants: ${models.ok ? Object.keys(models.data).length : 'n/a'}`);
  console.log(`orders (last 15 days): ${orders.ok ? orders.data.details.length : 'n/a'}`);
  console.log(`Saved raw responses to ${file}`);
});
