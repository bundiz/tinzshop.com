import { NextIntlClientProvider } from 'next-intl';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import th from '../../../../messages/th.json';
import ShopError from './error';

type ButtonProps = { onClick?: () => void; children?: ReactNode };

/** Finds the first <button> in a rendered element tree, so its onClick can be called without a DOM. */
function findButton(node: ReactNode): ReactElement<ButtonProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButton(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === 'button') return node as ReactElement<ButtonProps>;
  return findButton(node.props.children);
}

function render(retry: () => void) {
  let tree: ReactNode = null;
  // Calls the boundary inside a component, so its hooks run in a real render, and keeps the tree it returned.
  function Capture() {
    tree = ShopError({ error: new Error('connect ECONNREFUSED 10.0.0.1:5432'), retry });
    return <>{tree}</>;
  }
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      <Capture />
    </NextIntlClientProvider>,
  );
  return { html, tree };
}

describe('the shop error boundary', () => {
  it('shows the error message and a retry button, never the raw error', () => {
    const { html } = render(() => {});
    expect(html).toContain(th.shop.error.title);
    expect(html).toContain(th.shop.error.text);
    expect(html).toContain(th.shop.error.retry);
    expect(html).not.toContain('ECONNREFUSED');
  });

  it('calls retry when the button is clicked', () => {
    const retry = vi.fn();
    const button = findButton(render(retry).tree);
    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
