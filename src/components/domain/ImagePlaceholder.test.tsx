import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ImagePlaceholder from './ImagePlaceholder';

describe('ImagePlaceholder', () => {
  it('defaults to the neutral "other" tone, with no leftover legacy opacity class', () => {
    const html = renderToStaticMarkup(<ImagePlaceholder label="x" />);
    expect(html).toContain('#F2F3F6');
    expect(html).not.toContain('opacity-100');
    expect(html).not.toContain('text-brand');
  });

  it('draws each platform tone and the dark one with its own gradient', () => {
    expect(renderToStaticMarkup(<ImagePlaceholder tone="ps" />)).toContain('#EEF4FD');
    expect(renderToStaticMarkup(<ImagePlaceholder tone="ns" />)).toContain('#FDF0F2');
    expect(renderToStaticMarkup(<ImagePlaceholder tone="it" />)).toContain('#ECF7F5');
    expect(renderToStaticMarkup(<ImagePlaceholder tone="dark" />)).toContain('#24365A');
  });

  it('is decoration without a label and an image with one', () => {
    expect(renderToStaticMarkup(<ImagePlaceholder />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<ImagePlaceholder label="รูป" />)).toContain('role="img"');
  });
});
