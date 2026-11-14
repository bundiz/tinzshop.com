import type { ReactNode } from 'react';

/** A notice a redirect carries (`?confirmed=1`, `?expired=1`, `?error=google`): redirects keep no form state. The mockup's `.note`. */
export default function AuthNotice({ tone, children }: { tone: 'info' | 'error' | 'success'; children: ReactNode }) {
  const style = tone === 'error' ? 'bg-sale/8 text-sale' : tone === 'success' ? 'bg-ok-soft text-ok-ink' : 'bg-page text-ink-2';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`mb-3.5 rounded-md px-4 py-3.5 text-[14.5px] ${style}`}>
      {children}
    </p>
  );
}
