'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { buttonClass } from '@/components/ui/button-class';
import type { ShippingSizeTier } from '@/server/services/catalogue/product-detail-service';

export type ProductTabsProps = {
  /** Plain text from Shopee: rendered as text with its line breaks kept, never as HTML. */
  description: string;
  brandName: string | null;
  shippingSizeTier: ShippingSizeTier | null;
};

type TabId = 'description' | 'spec' | 'reviews' | 'shipping';

/**
 * The product information tabs: description and specifications when there is data for them, reviews, and
 * shipping and warranty (static text, its warranty link inert until that page exists; D-198). Only our own
 * reviews may be shown (spec O-6) and none exist yet, so the reviews tab is an empty state with an inert
 * "write a review" button: no stars, scores or counts (D-124).
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
  tabs.push('reviews', 'shipping');

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
    <section id="reviews" aria-label={t('tabs.label')} className="mt-14">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
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
            className={`flex min-h-[52px] cursor-pointer items-center border-b-[2.5px] px-[18px] font-semibold whitespace-nowrap transition-colors hover:text-ink ${
              tab === active ? 'border-accent text-ink' : 'border-transparent text-muted'
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
          className="py-7"
        >
          {tab === 'reviews' ? (
            <>
              <p className="text-ink-2">{t('reviews.empty')}</p>
              <a href="#" className={`${buttonClass({ variant: 'line' })} mt-5`}>
                {t('reviews.write')}
              </a>
            </>
          ) : tab === 'description' ? (
            <p className="max-w-[760px] leading-[1.8] whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]">
              {description}
            </p>
          ) : tab === 'shipping' ? (
            <div className="max-w-[760px] text-ink-2">
              {(['shipping', 'warranty', 'cancel'] as const).map((part) => (
                <div key={part}>
                  <h3 className="mt-[22px] mb-2 text-[21px] text-ink first:mt-0">{t(`shippingTab.${part}Title`)}</h3>
                  <p>
                    {part === 'warranty'
                      ? t.rich('shippingTab.warrantyText', {
                          link: (chunks) => (
                            <a
                              href="#"
                              className="inline-flex items-center font-semibold text-ink underline underline-offset-[3px]"
                            >
                              {chunks}
                            </a>
                          ),
                        })
                      : t(`shippingTab.${part}Text`)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[820px] border-collapse overflow-hidden rounded-md border border-line bg-surface">
                <tbody>
                  {specRows.map((row) => (
                    <tr key={row.label} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className="w-[34%] bg-page px-[18px] py-3.5 text-left align-top font-semibold"
                      >
                        {row.label}
                      </th>
                      <td className="px-[18px] py-3.5 text-left align-top [overflow-wrap:anywhere]">{row.value}</td>
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
