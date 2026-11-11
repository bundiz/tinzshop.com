import { cache } from 'react';
import { readSessionToken } from '../(auth)/auth-cookies';
import { getCurrentCustomerReader } from '@/server/composition-root';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';

/**
 * The signed-in customer for this request, or null. Read once per request however many components ask. It never
 * writes a cookie (D-174): a dead session is simply signed out, and the next Server Action clears its cookie.
 *
 * A failing read never breaks the page, because the header is on every shop page. It counts as signed out, and
 * only the error's name is logged, never its message, which can carry connection details.
 */
export const readCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  try {
    const token = await readSessionToken();
    if (token === undefined || token === '') return null;
    return await getCurrentCustomerReader()(token, new Date());
  } catch (error) {
    console.error(`customer session read failed: ${error instanceof Error ? error.name : 'unknown'}`);
    return null;
  }
});
