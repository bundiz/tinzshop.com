// THROWAWAY SPIKE. Creates Tinzshop-like mock products in the Shopee SANDBOX shop.
// Safe to re-run: products already recorded in .shopee-sandbox/seed-result.json are skipped.
// Usage: npm run shopee:seed

import { callShop, readState, runMain, sleep, writeState } from './lib.mjs';

// Values proven to work in this sandbox shop on 2026-10-20: a leaf category without extra
// mandatory attributes, the generic sandbox carrier, and an image already uploaded.
const CATEGORY_ID = 106468;
const LOGISTIC_ID = 71001;
const IMAGE_ID = 'sg-11134201-81z1k-muj2ro5yyn7mb3';

// Shopee asks for at least 5 seconds between creating an item and creating its variants.
const VARIANT_DELAY_MS = 6000;

const RESULT_FILE = 'seed-result.json';

// Prices are baht, as Shopee takes them. SKUs are SBX-* placeholders, not a real format (Q-014).
const PRODUCTS = [
  {
    key: 'switch-game-no-variant',
    name: '[SANDBOX] Mario Kart 8 Deluxe - Nintendo Switch Game',
    sku: 'SBX-SW-MK8',
    price: 1590,
    stock: 12,
    weight: 0.1,
    dims: [17, 11, 2],
  },
  {
    key: 'switch-game-one-tier',
    name: '[SANDBOX] Zelda Tears of the Kingdom - Nintendo Switch Game',
    sku: 'SBX-SW-TOTK',
    weight: 0.1,
    dims: [17, 11, 2],
    tiers: [{ name: 'Region', options: ['Asia EN', 'Asia TH'] }],
    models: [
      { index: [0], sku: 'SBX-SW-TOTK-EN', price: 1890, stock: 5 },
      { index: [1], sku: 'SBX-SW-TOTK-TH', price: 1890, stock: 3 },
    ],
  },
  {
    key: 'ps5-controller-colour',
    name: '[SANDBOX] DualSense Wireless Controller - PlayStation 5',
    sku: 'SBX-PS5-DS',
    weight: 0.3,
    dims: [17, 12, 7],
    tiers: [{ name: 'Colour', options: ['White', 'Midnight Black', 'Cosmic Red'] }],
    models: [
      { index: [0], sku: 'SBX-PS5-DS-WHT', price: 2490, stock: 8 },
      { index: [1], sku: 'SBX-PS5-DS-BLK', price: 2490, stock: 6 },
      { index: [2], sku: 'SBX-PS5-DS-RED', price: 2690, stock: 0 },
    ],
  },
  {
    key: 'it-gadget-two-tiers',
    name: '[SANDBOX] Portable SSD USB-C - IT Gadget',
    sku: 'SBX-IT-SSD',
    weight: 0.2,
    dims: [12, 8, 3],
    tiers: [
      { name: 'Capacity', options: ['1TB', '2TB'] },
      { name: 'Colour', options: ['Black', 'Blue'] },
    ],
    models: [
      { index: [0, 0], sku: 'SBX-IT-SSD-1TB-BLK', price: 2990, stock: 4 },
      { index: [0, 1], sku: 'SBX-IT-SSD-1TB-BLU', price: 2990, stock: 2 },
      { index: [1, 0], sku: 'SBX-IT-SSD-2TB-BLK', price: 4590, stock: 3 },
      { index: [1, 1], sku: 'SBX-IT-SSD-2TB-BLU', price: 4590, stock: 1 },
    ],
  },
  {
    key: 'pre-order',
    name: '[SANDBOX] Upcoming Release Pre-Order - Nintendo Switch Game',
    sku: 'SBX-SW-PRE',
    price: 1990,
    stock: 20,
    weight: 0.1,
    dims: [17, 11, 2],
    // Sandbox rejected 10: "The preorder DTS must be between 3 and 4".
    preOrderDaysToShip: 4,
    // 106468 rejects pre-order ("not allowed for the category"); try another sandbox leaf.
    categoryId: 106757,
  },
];

// Deliberately exceeds Shopee's documented 2-tier limit to confirm it in practice (Q-013).
const THREE_TIER_TEST = {
  key: 'limit-test-three-tiers',
  name: '[SANDBOX] Three Tier Limit Test - Not For Sale',
  sku: 'SBX-LIMIT-3T',
  weight: 0.1,
  dims: [10, 10, 2],
  tiers: [
    { name: 'Edition', options: ['Standard'] },
    { name: 'Language', options: ['TH'] },
    { name: 'Region', options: ['Asia'] },
  ],
  models: [{ index: [0, 0, 0], sku: 'SBX-LIMIT-3T-A', price: 990, stock: 1 }],
};

function addItemBody(product) {
  const hasVariants = Boolean(product.tiers);
  return {
    item_name: product.name,
    description: `${product.name}. Mock product for Tinzshop sandbox integration testing. Not for sale.`,
    original_price: hasVariants ? product.models[0].price : product.price,
    weight: product.weight,
    dimension: {
      package_length: product.dims[0],
      package_width: product.dims[1],
      package_height: product.dims[2],
    },
    category_id: product.categoryId ?? CATEGORY_ID,
    image: { image_id_list: [IMAGE_ID] },
    logistic_info: [{ logistic_id: LOGISTIC_ID, enabled: true }],
    brand: { brand_id: 0, original_brand_name: 'No Brand' },
    item_status: 'NORMAL',
    item_sku: product.sku,
    condition: 'NEW',
    seller_stock: [{ stock: hasVariants ? 0 : product.stock }],
    ...(product.preOrderDaysToShip
      ? { pre_order: { is_pre_order: true, days_to_ship: product.preOrderDaysToShip } }
      : {}),
  };
}

function initTierVariationBody(itemId, product) {
  return {
    item_id: itemId,
    standardise_tier_variation: product.tiers.map((tier) => ({
      variation_id: 0,
      variation_group_id: 0,
      variation_name: tier.name,
      variation_option_list: tier.options.map((option) => ({
        variation_option_id: 0,
        variation_option_name: option,
      })),
    })),
    model: product.models.map((model) => ({
      tier_index: model.index,
      model_sku: model.sku,
      original_price: model.price,
      seller_stock: [{ stock: model.stock }],
    })),
  };
}

async function createProduct(product) {
  const added = await callShop('POST', '/api/v2/product/add_item', { body: addItemBody(product) });
  const itemId = added.response.item_id;
  const result = { itemId, addItemWarning: added.warning || null };

  if (product.tiers) {
    await sleep(VARIANT_DELAY_MS);
    try {
      const variations = await callShop('POST', '/api/v2/product/init_tier_variation', {
        body: initTierVariationBody(itemId, product),
      });
      result.models = variations.response.model;
    } catch (error) {
      result.variantError = error.shopeeResponse ?? { message: error.message };
    }
  }
  return result;
}

runMain(async () => {
  const results = await readState(RESULT_FILE, {});

  for (const product of [...PRODUCTS, THREE_TIER_TEST]) {
    if (results[product.key]?.itemId) {
      console.log(`skip  ${product.key} (item ${results[product.key].itemId} already created)`);
      continue;
    }

    // A rejected product is recorded and retried on the next run; it does not stop the others.
    let result;
    try {
      result = await createProduct(product);
    } catch (error) {
      results[product.key] = { addItemError: error.shopeeResponse ?? { message: error.message } };
      await writeState(RESULT_FILE, results);
      console.log(`fail  ${product.key}: ${error.message}`);
      continue;
    }
    results[product.key] = result;
    await writeState(RESULT_FILE, results);

    const outcome = result.variantError
      ? `variants FAILED: ${result.variantError.message ?? result.variantError.error}`
      : `${result.models?.length ?? 0} variants`;
    console.log(`made  ${product.key} -> item ${result.itemId}, ${outcome}`);
  }

  console.log('Saved results to .shopee-sandbox/seed-result.json');
});
