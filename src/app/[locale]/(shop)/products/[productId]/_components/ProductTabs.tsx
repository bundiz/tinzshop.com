'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { ShippingSizeTier } from '@/server/services/catalogue/product-detail-service';

export type ProductTabsProps = {
  /** Plain text from Shopee: rendered as text with its line breaks kept, never as HTML. */
  description: string;
  brandName: string | null;
  shippingSizeTier: ShippingSizeTier | null;
};

type TabId = 'description' | 'spec';

/** The product information tabs: description and specifications. No reviews tab (O-6). */
export default function ProductTabs({ description, brandName, shippingSizeTier }: ProductTabsProps) {
  const t = useTranslations('shop.product');
  const idPrefix = useId();
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const specRows: { label: string; value: string }[] = [];
  if (brandName !== null && brandName !== '') specRows.push({ label: t('spec.brand'), value: brandName });
  if (shippingSizeTier !== null) {
    specRows.push({ label: t('spec.shippingSize'), value: t(`spec.shippingSizeTier.${shippingSizeTier}`) });
  }
  const tabs: TabId[] = [];
  if (description.trim() !== '') tabs.push('description');
  if (specRows.length > 0) tabs.push('spec');

  const [selected, setSelected] = useState<TabId | undefined>(tabs[0]);
  const active = selected !== undefined && tabs.includes(selected) ? selected : tabs[0];
  if (active === undefined) return null;

  // Arrow keys move between tabs, as the WAI-ARIA tabs pattern expects.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, from: TabId) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(from) + step + tabs.length) % tabs.length];
    if (next === undefined) return;
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section aria-label={t('tabs.label')} className="mt-4 overflow-hidden rounded-(--radius) bg-bg">
      <div role="tablist" className="flex overflow-x-auto border-b border-border [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab}`}
            aria-selected={tab === active}
            aria-controls={`${idPrefix}-panel-${tab}`}
            tabIndex={tab === active ? 0 : -1}
            onClick={() => setSelected(tab)}
            onKeyDown={(event) => onKeyDown(event, tab)}
            className={`flex min-h-[52px] cursor-pointer items-center border-b-[3px] px-3.5 text-[15px] font-semibold whitespace-nowrap hover:text-primary sm:px-5 ${
              tab === active ? 'border-primary text-primary' : 'border-transparent text-text-muted'
            }`}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`${idPrefix}-panel-${tab}`}
          aria-labelledby={`${idPrefix}-tab-${tab}`}
          hidden={tab !== active}
          tabIndex={0}
          className="px-4 py-5 min-[900px]:p-6"
        >
          {tab === 'description' ? (
            <p className="max-w-[820px] text-[15px] leading-[1.8] whitespace-pre-line [overflow-wrap:anywhere]">
              {description}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[820px] border-collapse text-sm">
                <tbody>
                  {specRows.map((row) => (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="w-[36%] border-b border-border bg-bg-subtle px-3.5 py-[11px] text-left align-top leading-[1.6] font-semibold text-text-muted"
                      >
                        {row.label}
                      </th>
                      <td className="border-b border-border px-3.5 py-[11px] text-left align-top leading-[1.6] [overflow-wrap:anywhere]">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
