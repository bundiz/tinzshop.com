import { googleRedirect } from '@/app/[locale]/(shop)/(auth)/auth-cookies';
import { getGoogleSignInDeps } from '@/server/composition-root';
import { localeOf, startGoogleSignIn } from '@/server/controllers/auth/google-sign-in-controller';

// Starts "Sign in with Google": sets tinzshop_oauth and sends the browser to Cognito (plan 014).
export async function GET(request: Request): Promise<Response> {
  const now = new Date();
  const params = new URL(request.url).searchParams;
  try {
    const outcome = startGoogleSignIn(getGoogleSignInDeps(), {
      returnTo: params.get('returnTo'),
      locale: params.get('locale'),
    });
    return googleRedirect(outcome, now);
  } catch (e) {
    // A configuration fault: the customer gets the sign-in page's Google error, not a 500.
    console.error('google sign-in failed', { code: e instanceof Error ? e.name : 'unknown' });
    return new Response(null, {
      status: 302,
      headers: { Location: `/${localeOf(params.get('locale'))}/sign-in?error=google`, 'Cache-Control': 'no-store' },
    });
  }
}
