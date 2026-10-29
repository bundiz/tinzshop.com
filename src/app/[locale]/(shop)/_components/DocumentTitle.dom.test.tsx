// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import DocumentTitle from './DocumentTitle';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('sets the tab title once mounted and renders nothing', () => {
  document.title = 'สินค้าทั้งหมด | Tinzshop';
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<DocumentTitle title="ไม่พบหน้านี้ | Tinzshop" />));
  expect(document.title).toBe('ไม่พบหน้านี้ | Tinzshop');
  expect(container.innerHTML).toBe('');
  act(() => root.unmount());
});
