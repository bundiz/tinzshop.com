// THROWAWAY SPIKE. Exchanges the one-time code from the authorization callback for tokens.
// Usage: npm run shopee:token -- <code> <shop_id>   (the code expires 10 minutes after authorizing)

import { callPublic, readConfig, runMain, saveTokens } from './lib.mjs';

runMain(async () => {
  const [code, shopIdArgument] = process.argv.slice(2);
  if (!code || !/^[1-9]\d*$/.test(shopIdArgument ?? '')) {
    throw new Error('Usage: npm run shopee:token -- <code> <shop_id>');
  }
  const shopId = Number(shopIdArgument);
  const { partnerId } = readConfig();

  const response = await callPublic('/api/v2/auth/token/get', {
    code,
    shop_id: shopId,
    partner_id: partnerId,
  });
  const tokens = await saveTokens(shopId, response);

  console.log(
    `Tokens saved for shop ${tokens.shopId}. Access token valid until ${new Date(tokens.expiresAt).toISOString()}.`,
  );
});
