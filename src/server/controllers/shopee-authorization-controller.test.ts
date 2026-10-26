import { describe, expect, it, vi } from 'vitest';

import { ShopeeApiError } from '@/server/adapters/shopee/errors';

import { createShopeeAuthorizationCallbackHandler } from './shopee-authorization-controller';

const CALLBACK_URL = 'http://localhost:3000/api/callbacks/shopee';
const CODE = '5a5477794a55537954697169514f4653';

type ConnectShop = (input: { code: string; externalShopId: bigint }) => Promise<void>;

function setup(connectShop: ConnectShop = async () => undefined) {
  const spy = vi.fn<ConnectShop>(connectShop);
  const handler = createShopeeAuthorizationCallbackHandler({ connectShop: spy });
  return { spy, call: (query: string) => handler(new Request(`${CALLBACK_URL}?${query}`)) };
}

describe('createShopeeAuthorizationCallbackHandler', () => {
  it('exchanges the code and reports the connected shop without echoing the code', async () => {
    const { spy, call } = setup();
    const response = await call(`code=${CODE}&shop_id=602226924`);

    expect(spy).toHaveBeenCalledWith({ code: CODE, externalShopId: 602226924n });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      data: { accountType: 'shop', shopId: 602226924, connected: true },
    });
    expect(text).not.toContain(CODE);
  });

  it('answers 422 for a main account and does not exchange the code', async () => {
    const { spy, call } = setup();
    const response = await call('code=abc123&main_account_id=1000016');

    expect(response.status).toBe(422);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: {
        code: 'shopee.authorization.main_account_unsupported',
        messageKey: 'error.shopee.authorization.mainAccountUnsupported',
      },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('answers 502 without the code when the token exchange fails', async () => {
    const { call } = setup(async () => {
      throw new ShopeeApiError({
        path: '/api/v2/auth/token/get',
        shopeeError: 'error_auth',
        httpStatus: 403,
      });
    });
    const response = await call(`code=${CODE}&shop_id=42`);
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse(text)).toEqual({
      error: {
        code: 'shopee.authorization.token_exchange_failed',
        messageKey: 'error.shopee.authorization.tokenExchangeFailed',
      },
    });
    expect(text).not.toContain(CODE);
  });

  it('lets an unexpected error propagate', async () => {
    const { call } = setup(async () => {
      throw new Error('database down');
    });

    await expect(call('code=abc123&shop_id=42')).rejects.toThrow('database down');
  });

  it('names the missing field when code is absent', async () => {
    const { call } = setup();
    const response = await call('shop_id=42');
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
    const { spy, call } = setup();
    const response = await call(query);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('shopee.authorization.invalid_callback');
    expect(spy).not.toHaveBeenCalled();
  });
});
