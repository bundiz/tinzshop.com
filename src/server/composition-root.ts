import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createWordPressClient } from '@/server/adapters/wordpress/client';
import { createWordPressNewsSource } from '@/server/adapters/wordpress/news-source';
import { createShopeeCatalogueSource } from '@/server/adapters/shopee/catalogue-source';
import { createShopeeClient, type ShopeeClient } from '@/server/adapters/shopee/client';
import { createShopeeTokenIssuer } from '@/server/adapters/shopee/token-issuer';
import { getServerConfig } from '@/server/config';
import { createCatalogueActivationJobHandler } from '@/server/controllers/catalogue/catalogue-activation-controller';
import { createApiDocsHandlers } from '@/server/controllers/api-docs/api-docs-controller';
import { createNewsImportJobHandler } from '@/server/controllers/news/news-import-controller';
import {
  tryWithAdvisoryLock,
  CATALOGUE_SYNC_LOCK_KEY,
  NEWS_IMPORT_LOCK_KEY,
} from '@/server/repositories/shared/advisory-lock';
import {
  findArticleSourceStates,
  upsertNewsArticle,
  upsertNewsCategories,
} from '@/server/repositories/news/news-repository';
import {
  listKnownItems,
  markItemsNotFound,
  upsertCatalogueItem,
} from '@/server/repositories/catalogue/catalogue-repository';
import {
  findChannelAuthorization,
  saveChannelAuthorization,
} from '@/server/repositories/channel/channel-authorization-repository';
import {
  findLastSucceededSyncRun,
  finishSyncRun,
  recordSkippedSyncRun,
  startSyncRun,
} from '@/server/repositories/catalogue/sync-run-repository';
import { activateSyncedProducts } from '@/server/repositories/catalogue/activation-repository';
import {
  findStorefrontProduct,
  listStorefrontCandidates,
} from '@/server/repositories/catalogue/storefront-repository';
import {
  getLandingCatalogue,
  type Locale,
  type LandingCatalogue,
} from '@/server/services/catalogue/landing-catalogue-service';
import { getProductDetail, type ProductDetail } from '@/server/services/catalogue/product-detail-service';
import { runCatalogueSync, type CatalogueSyncSummary } from '@/server/services/catalogue/catalogue-sync-service';
import { createChannelAuthorizationService } from '@/server/services/channel/channel-authorization-service';
import { runNewsImport } from '@/server/services/news/news-import-service';

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

/** The landing page read: built per call, needs no configuration beyond the database. */
export function getLandingCatalogueReader(): (locale: Locale) => Promise<LandingCatalogue> {
  return (locale) => getLandingCatalogue({ listStorefrontCandidates }, locale);
}

/** The product page read: built per call, needs no configuration beyond the database. */
export function getProductDetailReader(): (productId: string, locale: Locale) => Promise<ProductDetail | null> {
  return (productId, locale) => getProductDetail({ findStorefrontProduct }, productId, locale);
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

/** Development-only activation job (D-117); the secret is read per request and never in production. */
export function getCatalogueActivationHandler(): ReturnType<typeof createCatalogueActivationJobHandler> {
  return createCatalogueActivationJobHandler({
    isProduction: process.env.NODE_ENV === 'production',
    jobSecret: () => getServerConfig().jobSecret,
    activate: activateSyncedProducts,
  });
}

/**
 * The news import job (plan 012), built per request. Without `NEWS_IMPORT_SOURCE_URL` the handler
 * answers `503 news_import.not_configured` after the secret check.
 */
export function getNewsImportHandler(): ReturnType<typeof createNewsImportJobHandler> {
  const config = getServerConfig();
  const baseUrl = config.newsImportSourceUrl;
  return createNewsImportJobHandler({
    jobSecret: () => config.jobSecret,
    runImport:
      baseUrl === null
        ? null
        : () =>
            runNewsImport({
              source: createWordPressNewsSource(createWordPressClient({ baseUrl })),
              news: { upsertNewsCategories, upsertNewsArticle, findArticleSourceStates },
              lock: (task) => tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, task),
            }),
  });
}
