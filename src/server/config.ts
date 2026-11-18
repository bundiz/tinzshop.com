import { z } from 'zod';

export type ServerConfig = {
  readonly shopee: {
    readonly apiBaseUrl: string;
    readonly partnerId: number;
    readonly partnerKey: string;
    readonly shopId: bigint;
  };
  readonly jobSecret: string;
  readonly channelTokenEncryptionKey: Buffer;
  /** The old site's origin the news import reads (not a secret); null when unset. */
  readonly newsImportSourceUrl: string | null;
};

const DEFAULT_SHOPEE_API_BASE_URL = 'https://openplatform.sandbox.test-stable.shopee.sg';

// An empty value (as in .env.example) counts as unset.
const emptyAsUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const envSchema = z.object({
  SHOPEE_API_BASE_URL: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), 'must be an https URL')
      .default(DEFAULT_SHOPEE_API_BASE_URL),
  ),
  SHOPEE_PARTNER_ID: z.string().regex(/^[1-9][0-9]*$/, 'must be a positive integer'),
  SHOPEE_PARTNER_KEY: z.string().min(1),
  SHOPEE_SHOP_ID: z
    .string()
    .regex(/^[1-9][0-9]*$/, 'must be a positive integer')
    .refine((value) => Number.isSafeInteger(Number(value)), 'must be within the safe integer range'),
  JOB_SECRET: z.string().min(32, 'must be at least 32 characters'),
  CHANNEL_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 bytes, base64 encoded'),
  // Optional: only the news import needs it.
  NEWS_IMPORT_SOURCE_URL: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .url()
      .refine((value) => /^https?:\/\//.test(value), 'must be an http or https URL')
      .optional(),
  ),
});

function describeIssues(error: z.ZodError): string {
  // Names and reasons only: never the offending values.
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}

export function parseServerConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  const data = result.data;
  return {
    shopee: {
      apiBaseUrl: data.SHOPEE_API_BASE_URL,
      partnerId: Number(data.SHOPEE_PARTNER_ID),
      partnerKey: data.SHOPEE_PARTNER_KEY,
      shopId: BigInt(data.SHOPEE_SHOP_ID),
    },
    jobSecret: data.JOB_SECRET,
    channelTokenEncryptionKey: Buffer.from(data.CHANNEL_TOKEN_ENCRYPTION_KEY, 'base64'),
    newsImportSourceUrl: data.NEWS_IMPORT_SOURCE_URL ?? null,
  };
}

export type NewsImportJobConfig = {
  readonly jobSecret: string;
  readonly newsImportSourceUrl: string | null;
};

const newsImportJobSchema = envSchema.pick({ JOB_SECRET: true, NEWS_IMPORT_SOURCE_URL: true });

/** Only what the news import job needs, so a missing Shopee setting does not break it. */
export function parseNewsImportJobConfig(env: Readonly<Record<string, string | undefined>>): NewsImportJobConfig {
  const result = newsImportJobSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  return { jobSecret: result.data.JOB_SECRET, newsImportSourceUrl: result.data.NEWS_IMPORT_SOURCE_URL ?? null };
}

export function getNewsImportJobConfig(): NewsImportJobConfig {
  return parseNewsImportJobConfig(process.env);
}

export type AccountRoleJobConfig = { readonly jobSecret: string };

const accountRoleJobSchema = envSchema.pick({ JOB_SECRET: true });

/** Only the job secret, so the bootstrap job works on an environment with no Shopee settings. */
export function parseAccountRoleJobConfig(env: Readonly<Record<string, string | undefined>>): AccountRoleJobConfig {
  const result = accountRoleJobSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  return { jobSecret: result.data.JOB_SECRET };
}

export function getAccountRoleJobConfig(): AccountRoleJobConfig {
  return parseAccountRoleJobConfig(process.env);
}

export type TrustedProxyHeader = 'x-forwarded-for' | 'cf-connecting-ip';

export type AuthConfig = {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** The Cognito domain's full host name, without a scheme. */
  readonly domain: string;
  /** The site's public base URL, no trailing slash. The Cognito callback URL is built from it. */
  readonly appUrl: string;
  readonly sessionTokenEncryptionKey: Buffer;
  readonly trustedProxyHeader: TrustedProxyHeader;
};

const authEnvSchema = z.object({
  APP_URL: z.url(),
  COGNITO_REGION: z.string().min(1),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_CLIENT_SECRET: z.string().min(1),
  COGNITO_DOMAIN: z
    .string()
    .min(1)
    .refine((value) => !value.includes('://') && !value.includes('/'), 'must be a host name without a scheme or path'),
  SESSION_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 bytes, base64 encoded'),
  TRUSTED_PROXY_HEADER: z.preprocess(
    emptyAsUndefined,
    z.enum(['x-forwarded-for', 'cf-connecting-ip']).default('x-forwarded-for'),
  ),
});

/** Customer authentication settings (plan 014). Read lazily: signed-out pages never call this. */
export function parseAuthConfig(env: Readonly<Record<string, string | undefined>>): AuthConfig {
  const result = authEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  const data = result.data;
  return {
    region: data.COGNITO_REGION,
    userPoolId: data.COGNITO_USER_POOL_ID,
    clientId: data.COGNITO_CLIENT_ID,
    clientSecret: data.COGNITO_CLIENT_SECRET,
    domain: data.COGNITO_DOMAIN,
    appUrl: data.APP_URL.replace(/\/+$/, ''),
    sessionTokenEncryptionKey: Buffer.from(data.SESSION_TOKEN_ENCRYPTION_KEY, 'base64'),
    trustedProxyHeader: data.TRUSTED_PROXY_HEADER,
  };
}

let cachedAuth: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  cachedAuth ??= parseAuthConfig(process.env);
  return cachedAuth;
}

export type MediaConfig = {
  /** The environment's bucket (D-275). */
  readonly bucket: string;
  /** The bucket's region code, `ap-southeast-7` (D-274). */
  readonly region: string;
  /** The https address a media key is appended to, no trailing slash (D-277). */
  readonly publicBaseUrl: string;
};

// S3's bucket-name rules: 3 to 63 characters of lower case, digits, `.` and `-`, starting and ending with a letter or digit.
const BUCKET_NAME = /^(?=.{3,63}$)[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
const REGION_CODE = /^[a-z]{2}(-[a-z]+)+-[0-9]+$/;
// The base URL is written into an `src` attribute by string (D-138), so only https, a host, an optional port and a
// plain path are allowed: no user or password, query, fragment, quote, angle bracket or space can reach a page.
const PUBLIC_BASE_URL = /^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(:[0-9]{1,5})?(\/[A-Za-z0-9._~-]+)*$/;

const publicBaseUrlSchema = z
  .string()
  .min(1)
  .transform((value) => value.replace(/\/$/, ''))
  .refine((value) => PUBLIC_BASE_URL.test(value), 'must be an https URL with no query, fragment, user or password');

const mediaEnvSchema = z.object({
  MEDIA_S3_BUCKET: z.string().regex(BUCKET_NAME, 'must be an S3 bucket name'),
  MEDIA_S3_REGION: z.string().regex(REGION_CODE, 'must be a region code such as ap-southeast-7'),
  MEDIA_PUBLIC_BASE_URL: publicBaseUrlSchema,
});

/** The media storage settings (plan 017). Credentials are not settings: the AWS SDK reads them itself (D-275). */
export function parseMediaConfig(env: Readonly<Record<string, string | undefined>>): MediaConfig {
  const result = mediaEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  return {
    bucket: result.data.MEDIA_S3_BUCKET,
    region: result.data.MEDIA_S3_REGION,
    publicBaseUrl: result.data.MEDIA_PUBLIC_BASE_URL,
  };
}

let cachedMedia: MediaConfig | undefined;

/** Read lazily: only an upload needs the bucket settings. */
export function getMediaConfig(): MediaConfig {
  cachedMedia ??= parseMediaConfig(process.env);
  return cachedMedia;
}

const mediaPublicBaseUrlSchema = z.object({
  MEDIA_PUBLIC_BASE_URL: z.preprocess(emptyAsUndefined, publicBaseUrlSchema.optional()),
});

/** Only the base URL, for pages: null when it is unset, so a keyed image is left out rather than drawn broken (D-277). */
export function parseMediaPublicBaseUrl(env: Readonly<Record<string, string | undefined>>): string | null {
  const result = mediaPublicBaseUrlSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration. ${describeIssues(result.error)}`);
  }
  return result.data.MEDIA_PUBLIC_BASE_URL ?? null;
}

let cachedMediaPublicBaseUrl: string | null | undefined;

export function getMediaPublicBaseUrl(): string | null {
  if (cachedMediaPublicBaseUrl === undefined) cachedMediaPublicBaseUrl = parseMediaPublicBaseUrl(process.env);
  return cachedMediaPublicBaseUrl;
}

let cached: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  cached ??= parseServerConfig(process.env);
  return cached;
}

export function getDatabaseUrl(): string {
  const result = z.object({ DATABASE_URL: z.string().min(1) }).safeParse(process.env);
  if (!result.success) {
    throw new Error('Invalid server configuration. DATABASE_URL: must be set');
  }
  return result.data.DATABASE_URL;
}
