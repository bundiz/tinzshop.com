import { z } from 'zod';

/**
 * The customer password policy (D-177), written once. The pool enforces it (Cognito's answer stays
 * the final judge); the register and reset forms show these five rules and tick each one green as it is met (D-189).
 */

/** Cognito's documented special characters. A space also counts when it is not leading or trailing. */
const SPECIAL_CHARACTER = /[\^$*.[\]{}()?\-"!@#%&/\\,><':;|_~`+=]/;
const INNER_SPACE = /(?<=\S) (?=\S)/;

export const PASSWORD_MIN_LENGTH = 8;
/** Cognito's maximum password length. */
export const PASSWORD_MAX_LENGTH = 256;

export type PasswordRuleId = 'length' | 'number' | 'lowercase' | 'uppercase' | 'special';

export const PASSWORD_RULES: ReadonlyArray<{ id: PasswordRuleId; messageKey: string; test: (password: string) => boolean }> = [
  { id: 'length', messageKey: 'shop.auth.password.rule.length', test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'number', messageKey: 'shop.auth.password.rule.number', test: (p) => /[0-9]/.test(p) },
  { id: 'lowercase', messageKey: 'shop.auth.password.rule.lowercase', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', messageKey: 'shop.auth.password.rule.uppercase', test: (p) => /[A-Z]/.test(p) },
  { id: 'special', messageKey: 'shop.auth.password.rule.special', test: (p) => SPECIAL_CHARACTER.test(p) || INNER_SPACE.test(p) },
];

/** The rules this password breaks, in display order. */
export function failedPasswordRules(password: string): PasswordRuleId[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);
}

export const passwordSchema = z.string().max(PASSWORD_MAX_LENGTH, 'shop.auth.error.passwordPolicy').refine((password) => failedPasswordRules(password).length === 0, {
  message: 'shop.auth.error.passwordPolicy',
});
