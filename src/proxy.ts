import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Page routes only. `/api/**` (fixed URLs for outside callers), `/_next/**`
  // and any path with a file extension never pass through locale routing.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
