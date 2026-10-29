/**
 * Every failure of a call to the old site's WordPress API. The message is the path and a reason
 * only: never the URL, the query or any response body.
 */
export class WordPressApiError extends Error {
  readonly path: string;
  /** `network_error`, `timeout`, `http_error`, `non_json_response`, `invalid_response` or `missing_total_pages`. */
  readonly reason: string;
  /** 0 when no response arrived. */
  readonly httpStatus: number;

  constructor(input: {
    path: string;
    reason: string;
    httpStatus: number;
    /** Field paths and issue codes only, never a value. */
    detail?: string;
  }) {
    super(`${input.path}: ${input.reason}${input.detail === undefined ? "" : ` (${input.detail})`}`);
    this.name = "WordPressApiError";
    this.path = input.path;
    this.reason = input.reason;
    this.httpStatus = input.httpStatus;
  }
}
