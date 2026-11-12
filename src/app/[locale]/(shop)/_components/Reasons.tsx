import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/components/ui/Icon';

const REASONS: readonly { key: 'store' | 'staff' | 'warranty' | 'documents'; icon: IconName }[] = [
  { key: 'store', icon: 'store' },
  { key: 'staff', icon: 'chat' },
  { key: 'warranty', icon: 'wrench' },
  { key: 'documents', icon: 'receipt' },
];

/** "ทำไมเกมเมอร์ซื้อกับ Tinzshop": four reasons, in 1 / 2 / 4 columns (the mockup's `.reasons`). */
export default function Reasons() {
  const t = useTranslations('shop.home.reasons');

  return (
    <section aria-labelledby="reasons-title" className="wrap pt-[clamp(48px,6vw,80px)]">
      <div className="mb-6">
        <h2 id="reasons-title" className="text-[clamp(24px,2.4vw,32px)] font-bold">
          {t('title')}
        </h2>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {REASONS.map(({ key, icon }) => (
          <li key={key} className="rounded-lg border border-line bg-surface p-[22px]">
            <div className="mb-3.5 grid size-11 place-items-center rounded-md bg-brand-soft text-brand">
              <Icon name={icon} />
            </div>
            <h3 className="text-lg font-semibold">{t(`${key}.title`)}</h3>
            <p className="mt-1.5 text-[15px] text-ink-2">{t(`${key}.text`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
