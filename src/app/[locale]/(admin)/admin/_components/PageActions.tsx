'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The slot at the right of the back office's page bar, drawn by `AdminShell` (D-264). */
export const PAGE_ACTIONS_ID = 'admin-page-actions';

/**
 * A page's own actions, drawn in the page bar beside the breadcrumb (D-264): the article editor's preview, save draft and
 * publish. They are portalled into `AdminShell`'s slot once mounted; without the slot (a test, a page outside the shell)
 * they render where they stand, and before mount they are rendered hidden. A submit button among them names its form with the `form` attribute, since it sits
 * outside the `<form>` in the page.
 */
export default function PageActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [looked, setLooked] = useState(false);
  useEffect(() => {
    setSlot(document.getElementById(PAGE_ACTIONS_ID));
    setLooked(true);
  }, []);
  if (slot !== null) return createPortal(children, slot);
  // Before mount (the server's HTML) the buttons are in the page but hidden, so nothing jumps when they move to the bar.
  return (
    <div hidden={!looked} className="flex flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  );
}
