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

type TabId = 'description' | 'spec' | 'reviews';

/**
 * The product information tabs: description and specifications when there is data for them, and reviews.
 * Only our own reviews may be shown (spec O-6) and none exist yet, so the reviews tab is an empty state:
 * no stars, scores or counts (D-124).
 */
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
  tabs.push('reviews');

  const [selected, setSelected] = useState<TabId | undefined>(tabs[0]);
  const active: TabId = selected !== undefined && tabs.includes(selected) ? selected : (tabs[0] ?? 'reviews');

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
    <section id="reviews" aria-label={t('tabs.label')} className="mt-4 overflow-hidden rounded-(--radius) bg-bg">
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
          className="px-4 py-5 md:p-6"
        >
          {tab === 'reviews' ? (
            <p className="text-[15px] text-text-muted">{t('reviews.empty')}</p>
          ) : tab === 'description' ? (
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
