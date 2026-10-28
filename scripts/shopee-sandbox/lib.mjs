// THROWAWAY SPIKE — not production code. Used to fill the Shopee sandbox shop with mock
// data and capture Shopee's real response shapes before the database is designed.
//
// Talks ONLY to Shopee's sandbox host. Reads SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY from the
// environment (loaded by `node --env-file=.env`). Never prints the partner key or any token.
// Tokens and dumps are written to .shopee-sandbox/, which is git-ignored.
//
// Signing and token rules: open.shopee.com/developer-guide/20 (read 2026-10-20).

import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SANDBOX_HOST = 'https://openplatform.sandbox.test-stable.shopee.sg';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const STATE_DIR = join(REPO_ROOT, '.shopee-sandbox');
const TOKEN_FILE = join(STATE_DIR, 'tokens.json');

// Refresh the access token when less than this much validity remains.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function readConfig() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
    throw new Error('SHOPEE_PARTNER_ID is missing or not a positive integer in .env');
  }
  if (!partnerKey) {
    throw new Error('SHOPEE_PARTNER_KEY is missing in .env');
  }
  return { partnerId, partnerKey };
}

function sign(partnerKey, parts) {
  return createHmac('sha256', partnerKey).update(parts.join('')).digest('hex');
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function request(method, path, query, body) {
  const url = new URL(path, SANDBOX_HOST);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  // Error messages name the path only: the full URL carries the access token and sign.
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path}: HTTP ${response.status}, response was not JSON`);
  }
  if (json.error) {
    const error = new Error(`${path}: ${json.error} — ${json.message ?? ''}`);
    error.shopeeResponse = json;
    throw error;
  }
  return json;
}

// Public APIs (auth): sign base string is partner_id + path + timestamp.
export async function callPublic(path, body) {
  const { partnerId, partnerKey } = readConfig();
  const timestamp = nowSeconds();
  const signature = sign(partnerKey, [partnerId, path, timestamp]);
  return request('POST', path, { partner_id: partnerId, timestamp, sign: signature }, body);
}

export async function saveTokens(shopId, tokenResponse) {
  await mkdir(STATE_DIR, { recursive: true });
  const tokens = {
    shopId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expire_in * 1000,
  };
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return tokens;
}

async function loadTokens() {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
  } catch {
    throw new Error('No saved tokens. Authorize the shop, then run: npm run shopee:token -- <code> <shop_id>');
  }
}

// A refresh_token works once; the new pair is saved immediately so it is never lost.
async function freshTokens() {
  const tokens = await loadTokens();
  if (tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS) return tokens;

  const { partnerId } = readConfig();
  const refreshed = await callPublic('/api/v2/auth/access_token/get', {
    shop_id: tokens.shopId,
    refresh_token: tokens.refreshToken,
    partner_id: partnerId,
  });
  return saveTokens(tokens.shopId, refreshed);
}

// Shop APIs: sign base string is partner_id + path + timestamp + access_token + shop_id.
export async function callShop(method, path, { query = {}, body } = {}) {
  const { partnerId, partnerKey } = readConfig();
  const tokens = await freshTokens();
  const timestamp = nowSeconds();
  const signature = sign(partnerKey, [partnerId, path, timestamp, tokens.accessToken, tokens.shopId]);
  return request(
    method,
    path,
    {
      ...query,
      partner_id: partnerId,
      timestamp,
      access_token: tokens.accessToken,
      shop_id: tokens.shopId,
      sign: signature,
    },
    body,
  );
}

export async function readState(name, fallback) {
  try {
    return JSON.parse(await readFile(join(STATE_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeState(name, data) {
  await mkdir(STATE_DIR, { recursive: true });
  const file = join(STATE_DIR, name);
  await writeFile(file, JSON.stringify(data, null, 2));
  return file;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMain(main) {
  try {
    await main();
  } catch (error) {
    console.error(`FAILED: ${error.message}`);
    if (error.shopeeResponse) console.error(JSON.stringify(error.shopeeResponse, null, 2));
    process.exitCode = 1;
  }
}
