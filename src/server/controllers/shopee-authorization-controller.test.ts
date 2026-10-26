import { describe, expect, it } from 'vitest';

import { handleShopeeAuthorizationCallback } from './shopee-authorization-controller';

const CALLBACK_URL = 'http://localhost:3000/api/callbacks/shopee';

function callback(query: string): Response {
  return handleShopeeAuthorizationCallback(new Request(`${CALLBACK_URL}?${query}`));
}

describe('handleShopeeAuthorizationCallback', () => {
  it('returns the shop_id and code when a shop account authorizes', async () => {
    const response = callback('code=5a5477794a55537954697169514f4653&shop_id=602226924');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        accountType: 'shop',
        shopId: 602226924,
        code: '5a5477794a55537954697169514f4653',
        state: null,
      },
    });
  });

  it('returns the main_account_id when a main account authorizes', async () => {
    const response = callback('code=abc123&main_account_id=1000016');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        accountType: 'main_account',
        mainAccountId: 1000016,
        code: 'abc123',
        state: null,
      },
    });
  });

  it('passes the state value back unchanged', async () => {
    const response = callback('code=abc123&shop_id=42&state=r4nd0m-Value');

    expect((await response.json()).data.state).toBe('r4nd0m-Value');
  });

  it('tells the browser not to cache the response, since the code is a one-time credential', () => {
    const response = callback('code=abc123&shop_id=42');

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('names the missing field when code is absent', async () => {
    const response = callback('shop_id=42');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('shopee.authorization.invalid_callback');
    expect(body.error.details).toContainEqual(expect.objectContaining({ path: 'code' }));
  });

  it.each([
    ['empty code', 'code=&shop_id=42'],
    ['neither shop_id nor main_account_id', 'code=abc123'],
    ['both shop_id and main_account_id', 'code=abc123&shop_id=42&main_account_id=7'],
    ['non-numeric shop_id', 'code=abc123&shop_id=12a'],
    ['hexadecimal shop_id', 'code=abc123&shop_id=0x1F'],
    ['zero shop_id', 'code=abc123&shop_id=0'],
    ['negative main_account_id', 'code=abc123&main_account_id=-5'],
    ['shop_id beyond the safe integer range', 'code=abc123&shop_id=9007199254740993'],
  ])('rejects a callback with %s', async (_label, query) => {
    const response = callback(query);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('shopee.authorization.invalid_callback');
  });
});
