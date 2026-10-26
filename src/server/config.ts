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
  };
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
