import Link from 'next/link';
import type { ReactNode } from 'react';

export type AuthCardProps = {
  title: string;
  description: string;
  /** The other page's link, shown at the card's top right. */
  switchHref: string;
  switchLabel: string;
  children: ReactNode;
};

/**
 * The centred card all four auth pages share (spec section 8): the title and a short description at the top, with
 * the link to the other page at the top right. Built with Tailwind and the design's tokens, no component library.
 */
export default function AuthCard({ title, description, switchHref, switchLabel, children }: AuthCardProps) {
  return (
    <main className="px-4 py-8 md:py-12">
      <section
        aria-labelledby="auth-title"
        className="mx-auto w-full max-w-sm rounded-(--radius) border border-border bg-bg p-5 shadow-card sm:p-6"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="auth-title" className="text-[22px] leading-[1.35] font-extrabold">
              {title}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          </div>
          <Link
            href={switchHref}
            className="-mt-1 inline-flex min-h-11 flex-none items-center text-sm font-semibold text-primary hover:text-primary-dark"
          >
            {switchLabel}
          </Link>
        </header>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}
