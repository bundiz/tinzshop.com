import { googleRedirect, readOauthCookie, readSessionCookie } from '@/app/[locale]/(shop)/(auth)/auth-cookies';
import { getGoogleSignInDeps } from '@/server/composition-root';
import { handleGoogleCallback } from '@/server/controllers/auth/google-sign-in-controller';

// Cognito returns the customer here after Google (plan 014). Every answer is a 302 with no-store.
export async function GET(request: Request): Promise<Response> {
  const now = new Date();
  const params = new URL(request.url).searchParams;
  try {
    const outcome = await handleGoogleCallback(getGoogleSignInDeps(), {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
      oauth: readOauthCookie(request, now),
      sessionToken: readSessionCookie(request),
      now,
    });
    return googleRedirect(outcome, now);
  } catch (e) {
    console.error('google sign-in failed', { code: e instanceof Error ? e.name : 'unknown' });
    return new Response(null, {
      status: 302,
      headers: { Location: '/th/sign-in?error=google', 'Cache-Control': 'no-store' },
    });
  }
}
