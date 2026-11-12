import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../messages/th.json';
import StockBadge from './StockBadge';

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );

describe('StockBadge', () => {
  it('is green or muted on a light background', () => {
    expect(render(<StockBadge status="in_stock" />)).toContain('text-ok');
    expect(render(<StockBadge status="out_of_stock" />)).toContain('text-muted');
  });

  it('uses the on-navy colours on a dark background, where the green would not read', () => {
    const inStock = render(<StockBadge status="in_stock" onDark />);
    expect(inStock).toContain('text-on-navy');
    expect(inStock).not.toContain('text-ok');
    expect(render(<StockBadge status="out_of_stock" onDark />)).toContain('text-on-navy-2');
  });
});
