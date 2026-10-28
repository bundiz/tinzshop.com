import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createShopeeCatalogueSource } from '@/server/adapters/shopee/catalogue-source';
import { createShopeeClient, type ShopeeClient } from '@/server/adapters/shopee/client';
import { createShopeeTokenIssuer } from '@/server/adapters/shopee/token-issuer';
import { getServerConfig } from '@/server/config';
import { createApiDocsHandlers } from '@/server/controllers/api-docs-controller';
import { tryWithAdvisoryLock, CATALOGUE_SYNC_LOCK_KEY } from '@/server/repositories/advisory-lock';
import {
  listKnownItems,
  markItemsNotFound,
  upsertCatalogueItem,
} from '@/server/repositories/catalogue-repository';
import {
  findChannelAuthorization,
  saveChannelAuthorization,
} from '@/server/repositories/channel-authorization-repository';
import {
  findLastSucceededSyncRun,
  finishSyncRun,
  recordSkippedSyncRun,
  startSyncRun,
} from '@/server/repositories/sync-run-repository';
import { runCatalogueSync, type CatalogueSyncSummary } from '@/server/services/catalogue-sync-service';
import { createChannelAuthorizationService } from '@/server/services/channel-authorization-service';

// Built on first use, never at import, so `next build` needs no environment.
let shopeeClient: ShopeeClient | undefined;
let authorizationService: ReturnType<typeof createChannelAuthorizationService> | undefined;

export function getShopeeClient(): ShopeeClient {
  if (shopeeClient === undefined) {
    const { shopee } = getServerConfig();
    shopeeClient = createShopeeClient({
      baseUrl: shopee.apiBaseUrl,
      partnerId: shopee.partnerId,
      partnerKey: shopee.partnerKey,
    });
  }
  return shopeeClient;
}

export function getChannelAuthorizationService(): ReturnType<
  typeof createChannelAuthorizationService
> {
  if (authorizationService === undefined) {
    authorizationService = createChannelAuthorizationService({
      issuer: createShopeeTokenIssuer(getShopeeClient()),
      repository: { find: findChannelAuthorization, save: saveChannelAuthorization },
      encryptionKey: getServerConfig().channelTokenEncryptionKey,
      now: () => new Date(),
    });
  }
  return authorizationService;
}

export function getCatalogueSyncRunner(): () => Promise<CatalogueSyncSummary> {
  return () =>
    runCatalogueSync({
      source: createShopeeCatalogueSource({
        client: getShopeeClient(),
        credentials: () => getChannelAuthorizationService().getShopCredentials(),
      }),
      catalogue: { upsertCatalogueItem, listKnownItems, markItemsNotFound },
      syncRuns: { startSyncRun, finishSyncRun, recordSkippedSyncRun, findLastSucceededSyncRun },
      lock: (task) => tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, task),
      now: () => new Date(),
    });
}

/** Development-only API docs; needs no configuration, so it works before `.env` is complete. */
export function getApiDocsHandlers(): ReturnType<typeof createApiDocsHandlers> {
  return createApiDocsHandlers({
    isProduction: process.env.NODE_ENV === 'production',
    readFile: (path) => readFile(path, 'utf8'),
    specPath: join(process.cwd(), 'docs', 'openapi.yaml'),
    assetDir: join(process.cwd(), 'node_modules', 'swagger-ui-dist'),
  });
}
