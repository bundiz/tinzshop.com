import type { ReactNode } from 'react';

/** A notice a redirect carries (`?confirmed=1`, `?expired=1`, `?error=google`): redirects keep no form state. */
export default function AuthNotice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  const style = tone === 'error' ? 'border-danger/40 bg-danger/5 text-danger' : 'border-primary/30 bg-primary-soft text-text';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-(--radius-sm) border px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  );
}
