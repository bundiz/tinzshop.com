import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createWordPressClient } from '@/server/adapters/wordpress/client';
import { createWordPressNewsSource } from '@/server/adapters/wordpress/news-source';
import { createShopeeCatalogueSource } from '@/server/adapters/shopee/catalogue-source';
import { createShopeeClient, type ShopeeClient } from '@/server/adapters/shopee/client';
import { createShopeeTokenIssuer } from '@/server/adapters/shopee/token-issuer';
import { createCognitoIdentity } from '@/server/adapters/cognito/client';
import { getAccountRoleJobConfig, getAuthConfig, getNewsImportJobConfig, getServerConfig } from '@/server/config';
import { createCatalogueCategoriseJobHandler } from '@/server/controllers/catalogue/catalogue-categorise-controller';
import { createCatalogueActivationJobHandler } from '@/server/controllers/catalogue/catalogue-activation-controller';
import { createApiDocsHandlers } from '@/server/controllers/api-docs/api-docs-controller';
import { hitRateLimit } from '@/server/repositories/auth/auth-rate-limit-repository';
import { findCustomerByEmail, upsertCustomerBySub } from '@/server/repositories/auth/customer-repository';
import {
  deleteCustomerSession,
  deleteCustomerSessions,
  findCustomerSession,
  insertCustomerSession,
  updateSessionAccessToken,
} from '@/server/repositories/auth/customer-session-repository';
import type { GoogleSignInDeps } from '@/server/controllers/auth/google-sign-in-controller';
import type { CognitoIdentity } from '@/server/services/auth/cognito-identity';
import type { CustomerAuthDeps } from '@/server/services/auth/customer-auth-service';
import {
  readCustomerSession,
  type CurrentCustomer,
  type CustomerSessionDeps,
} from '@/server/services/auth/customer-session-service';
import { createAccountRoleJobHandler } from '@/server/controllers/access/account-role-job-controller';
import { changeAccountRole, findAccountByEmail } from '@/server/repositories/access/access-repository';
import { createNewsImportJobHandler } from '@/server/controllers/news/news-import-controller';
import {
  tryWithAdvisoryLock,
  CATALOGUE_SYNC_LOCK_KEY,
  NEWS_IMPORT_LOCK_KEY,
} from '@/server/repositories/shared/advisory-lock';
import {
  findAdminArticle,
  findEditorFirstName,
  findExistingCategoryIds,
  findExistingProductIds,
  findListedCategoryIds,
  listAdminArticles,
  saveArticle as saveNewsArticle,
  setArticleDeleted,
} from '@/server/repositories/news/news-admin-repository';
import {
  applyExcludedNewsCategories,
  countLiveNewsArticles,
  findLiveNewsArticle,
  findArticleSourceStates,
  listLiveNewsArticles,
  countLiveNewsArticlesByCategory,
  listNewsCategories,
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
import { categoriseProducts } from '@/server/repositories/catalogue/categorise-repository';
import { activateSyncedProducts } from '@/server/repositories/catalogue/activation-repository';
import {
  countStorefrontFacets,
  findStorefrontProduct,
  listStorefrontCandidates,
  listStorefrontCategories,
  listStorefrontProducts,
} from '@/server/repositories/catalogue/storefront-repository';
import {
  getLandingCatalogue,
  type Locale,
  type LandingCatalogue,
} from '@/server/services/catalogue/landing-catalogue-service';
import { getProductDetail, type ProductDetail } from '@/server/services/catalogue/product-detail-service';
import {
  getStorefrontListing,
  type StorefrontListing,
  type StorefrontListingSearchParams,
} from '@/server/services/catalogue/storefront-listing-service';
import { runCatalogueSync, type CatalogueSyncSummary } from '@/server/services/catalogue/catalogue-sync-service';
import { createChannelAuthorizationService } from '@/server/services/channel/channel-authorization-service';
import {
  getAdminArticle,
  listAdminArticles as listAdminNewsArticles,
  restoreArticle,
  saveArticle,
  trashArticle,
  type NewsAdminDeps,
} from '@/server/services/news/news-admin-service';
import { sanitizeArticleHtml } from '@/server/adapters/wordpress/sanitize';
import { runNewsImport } from '@/server/services/news/news-import-service';
import {
  getNewsArticle,
  listLatestNews,
  listListedNewsCategories,
  listNews,
  type GetNewsArticleInput,
  type ListedNewsCategory,
  type ListNewsInput,
  type NewsArticleDetail,
  type NewsCardData,
  type NewsListPage,
} from '@/server/services/news/news-read-service';

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

/** The product listing page read (plan 013); `null` means a 404 (R2). Needs only the database. */
export function getStorefrontListingReader(): (
  searchParams: StorefrontListingSearchParams,
  locale: Locale,
) => Promise<StorefrontListing | null> {
  return (searchParams, locale) =>
    getStorefrontListing(
      { listStorefrontCategories, listStorefrontProducts, countStorefrontFacets },
      searchParams,
      locale,
    );
}

/** The product page read: built per call, needs no configuration beyond the database. */
export function getProductDetailReader(): (productId: string, locale: Locale) => Promise<ProductDetail | null> {
  return (productId, locale) => getProductDetail({ findStorefrontProduct }, productId, locale);
}

/** The news list and category pages' read (plan 012): built per call, needs no configuration beyond the database. */
export function getNewsReader(): (input: ListNewsInput) => Promise<NewsListPage | null> {
  return (input) =>
    listNews(
      {
        news: { listNewsCategories, countLiveNewsArticlesByCategory, countLiveNewsArticles, listLiveNewsArticles },
        now: () => new Date(),
      },
      input,
    );
}

/** The news article page's read (plan 012 Task 6): built per call, needs no configuration beyond the database. */
export function getNewsArticleReader(): (input: GetNewsArticleInput) => Promise<NewsArticleDetail | null> {
  return (input) =>
    getNewsArticle(
      { news: { listNewsCategories, listLiveNewsArticles, findLiveNewsArticle }, now: () => new Date() },
      input,
    );
}

/** The landing page's newest news (plan 012 Task 6): built per call, needs no configuration beyond the database. */
export function getLatestNewsReader(): (input: { locale: Locale; limit: number }) => Promise<NewsCardData[]> {
  return (input) => listLatestNews({ news: { listNewsCategories, listLiveNewsArticles }, now: () => new Date() }, input);
}

/** The header's listed news categories, for the บทความ menu (D-140): built per call, needs only the database. */
export function getListedNewsCategoriesReader(): (locale: Locale) => Promise<ListedNewsCategory[]> {
  return (locale) => listListedNewsCategories({ news: { listNewsCategories } }, { locale });
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

/** Development-only categorise job (D-143); the secret is read per request and never in production. */
export function getCatalogueCategoriseHandler(): ReturnType<typeof createCatalogueCategoriseJobHandler> {
  return createCatalogueCategoriseJobHandler({
    isProduction: process.env.NODE_ENV === 'production',
    jobSecret: () => getServerConfig().jobSecret,
    categorise: categoriseProducts,
  });
}

/**
 * The news import job (plan 012). Settings are read per request, after the secret check where they
 * can be, and only the job's own (`JOB_SECRET`, `NEWS_IMPORT_SOURCE_URL`), so a missing Shopee
 * setting never affects it. Without the source URL the handler answers `503 news_import.not_configured`.
 */
export function getNewsImportHandler(): ReturnType<typeof createNewsImportJobHandler> {
  return createNewsImportJobHandler({
    jobSecret: () => getNewsImportJobConfig().jobSecret,
    sourceUrl: () => getNewsImportJobConfig().newsImportSourceUrl,
    runImport: (baseUrl, options) =>
      runNewsImport(
        {
          source: createWordPressNewsSource(createWordPressClient({ baseUrl })),
          news: { upsertNewsCategories, upsertNewsArticle, findArticleSourceStates, applyExcludedNewsCategories },
          lock: (task) => tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, task),
          logError: (message) => console.error(message),
        },
        options,
      ),
  });
}

/**
 * The news authoring service (plan 016): built per call, needs only the database. Every body goes through
 * `sanitizeArticleHtml`, the import's sanitiser (`docs/05-database.md`, *News*).
 */
export function getNewsAdmin() {
  const deps: NewsAdminDeps = {
    news: {
      listAdminArticles,
      findAdminArticle,
      findExistingCategoryIds,
      findListedCategoryIds,
      findExistingProductIds,
      findEditorFirstName,
      saveArticle: saveNewsArticle,
      setArticleDeleted,
    },
    sanitize: (html) => sanitizeArticleHtml(html).html,
    now: () => new Date(),
  };
  return {
    list: (input: Parameters<typeof listAdminNewsArticles>[1]) => listAdminNewsArticles(deps, input),
    get: (id: string) => getAdminArticle(deps, id),
    save: (input: Parameters<typeof saveArticle>[1]) => saveArticle(deps, input),
    trash: (id: string, editorId: string) => trashArticle(deps, id, editorId),
    restore: (id: string, editorId: string) => restoreArticle(deps, id, editorId),
  };
}

let cognitoIdentity: CognitoIdentity | undefined;

/** The Cognito adapter, built on first use so a request that never signs in never reads auth config. */
export function getCognitoIdentity(): CognitoIdentity {
  cognitoIdentity ??= createCognitoIdentity(getAuthConfig());
  return cognitoIdentity;
}

/** The session service's dependencies (plan 014): Cognito and the key are read lazily. */
export function getCustomerSessionDeps(): CustomerSessionDeps {
  return {
    getCognito: getCognitoIdentity,
    getSessionKey: () => getAuthConfig().sessionTokenEncryptionKey,
    sessions: {
      insert: insertCustomerSession,
      find: findCustomerSession,
      updateAccessToken: updateSessionAccessToken,
      delete: deleteCustomerSession,
      deleteAll: deleteCustomerSessions,
    },
    log: (message, fields) => console.error(message, fields),
  };
}

/** The customer auth service's dependencies (plan 014 Task 7). Logs carry codes and hashes only. */
export function getCustomerAuthDeps(): CustomerAuthDeps {
  return {
    getCognito: getCognitoIdentity,
    rateLimit: { hitRateLimit },
    customers: { upsertBySub: upsertCustomerBySub, findByEmail: findCustomerByEmail },
    session: getCustomerSessionDeps(),
    log: (message, fields) => console.error(message, fields),
  };
}

/** The Google sign-in controller's dependencies (plan 014 Task 8). */
export function getGoogleSignInDeps(): GoogleSignInDeps {
  return {
    auth: getCustomerAuthDeps(),
    redirectUri: `${getAuthConfig().appUrl}/api/callbacks/cognito`,
  };
}

/**
 * The signed-in customer for a session cookie value, or null (plan 014 Task 9). Built per call; with no
 * cookie it answers null without reading auth config. It never writes a cookie (D-174, R2).
 */
export function getCurrentCustomerReader(): (token: string | undefined, now: Date) => Promise<CurrentCustomer | null> {
  return (token, now) => readCustomerSession(getCustomerSessionDeps(), token, now);
}

/** The account-role job (plan 016, D-235): every environment, reads only `JOB_SECRET`. */
export function getAccountRoleHandler(): ReturnType<typeof createAccountRoleJobHandler> {
  return createAccountRoleJobHandler({
    jobSecret: () => getAccountRoleJobConfig().jobSecret,
    findAccountByEmail,
    changeAccountRole,
    log: (message) => console.info(message),
  });
}
