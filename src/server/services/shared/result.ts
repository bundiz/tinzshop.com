/** The result shape of 06-api.md: expected outcomes are returned, thrown exceptions are for bugs (D-022). */
export type DomainError = {
  /** Stable and machine-readable; never shown to a user. */
  code: string;
  /** English, for developers and logs. */
  message: string;
  /** Message catalogue key, for the user (D-032). */
  messageKey: string;
  /** Field-level validation failures. */
  details?: unknown;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: DomainError };
