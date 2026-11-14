import type { ReactNode } from 'react';

export type AuthCardProps = {
  title: string;
  /** A plain line under the title (verify and forgot password). */
  description?: string;
  /** The rich line under the title with the link to the other page ("ยังไม่มีบัญชี? สมัครสมาชิก"). */
  switchPrompt?: ReactNode;
  children: ReactNode;
};

/**
 * The card all four auth pages share: the title, and under it a line that says what the page is or links to the
 * other page (D-220). The page's `main` and the perks panel are `AuthShell`'s.
 */
export default function AuthCard({ title, description, switchPrompt, children }: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-title"
      className="rounded-[16px] border border-line bg-surface px-[18px] py-[22px] sm:rounded-xl sm:p-[clamp(24px,3vw,40px)]"
    >
      <header data-auth-header>
        <h1 id="auth-title" className="text-[clamp(28px,2.6vw,36px)] font-bold">
          {title}
        </h1>
        {description !== undefined && (
          <p className={`mt-1.5 text-ink-2 ${switchPrompt === undefined ? 'mb-6' : ''}`}>{description}</p>
        )}
        {switchPrompt !== undefined && <p className="mt-1.5 mb-6 text-ink-2">{switchPrompt}</p>}
      </header>
      {children}
    </section>
  );
}

/** The mockup's `.link`, for a link in the card's text. */
export const AUTH_LINK_CLASS =
  'inline-flex min-h-11 items-center gap-1.5 bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1.5px] bg-left-bottom bg-no-repeat font-semibold text-ink hover:bg-[length:100%_1.5px] sm:min-h-0';
