/**
 * Every failure of a Shopee call. The message is the path and Shopee's error
 * code only: never the URL, query, token, signature, partner key or any body.
 */
export class ShopeeApiError extends Error {
  readonly path: string;
  readonly shopeeError: string;
  readonly requestId: string | null;
  readonly httpStatus: number;

  constructor(input: {
    path: string;
    shopeeError: string;
    requestId?: string | null;
    httpStatus: number;
    /** Field paths and issue codes only, never a value. */
    detail?: string;
  }) {
    super(`${input.path}: ${input.shopeeError}${input.detail === undefined ? "" : ` (${input.detail})`}`);
    this.name = "ShopeeApiError";
    this.path = input.path;
    this.shopeeError = input.shopeeError;
    this.requestId = input.requestId ?? null;
    this.httpStatus = input.httpStatus;
  }
}
