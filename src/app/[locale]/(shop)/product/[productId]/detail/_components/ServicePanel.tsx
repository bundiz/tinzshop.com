import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/components/ui/Icon';

const ITEMS: { key: 'shipping' | 'taxInvoice' | 'store'; icon: IconName }[] = [
  { key: 'shipping', icon: 'truck' },
  { key: 'taxInvoice', icon: 'receipt' },
  { key: 'store', icon: 'store' },
];

const PAYMENT_CHIPS = ['card', 'instalment', 'promptPay'] as const;

/**
 * The product page's service panel from the design: shipping (with the rate link), tax invoice, store,
 * the contact line and the K-Payment block with its chips (K-Payment is the sole method, D-096). The rate
 * and contact links are inert until those pages exist (D-124).
 */
export default function ServicePanel() {
  const t = useTranslations('shop.product.service');
  const link = 'font-semibold text-primary';

  return (
    <aside aria-label={t('label')} className="rounded-(--radius) bg-bg p-4 md:col-span-full lg:col-auto">
      <h2 className="mb-3.5 text-[15px]">{t('title')}</h2>
      <ul className="grid gap-3.5">
        {ITEMS.map(({ key, icon }) => (
          <li key={key} className="grid grid-cols-[36px_1fr] items-start gap-2.5">
            <ServiceIcon icon={icon} />
            <div className="min-w-0">
              <strong className="block text-sm leading-[1.5]">{t(`${key}.title`)}</strong>
              <p className="text-[13px] leading-[1.55] text-text-subtle">
                {t(`${key}.text`)}
                {key === 'shipping' && (
                  <>
                    {' '}
                    <a href="#" className={link}>
                      {t('shipping.rateLink')}
                    </a>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[36px_1fr] items-start gap-2.5">
          <ServiceIcon icon="chat" />
          <div className="min-w-0">
            <strong className="block text-sm leading-[1.5]">{t('contact.title')}</strong>
            <p className="text-[13px] leading-[1.55] text-text-subtle">
              <a href="#" className={link}>
                {t('contact.link')}
              </a>
            </p>
          </div>
        </li>
      </ul>
      <div className="mt-4 rounded-(--radius-sm) border border-dashed border-[#b7d9c5] bg-[#f3faf6] p-3 text-[13px] leading-[1.55]">
        <strong className="flex items-center gap-2 text-[#0b6b3a]">
          <Icon name="shield" className="size-4" />
          {t('payment.title')}
        </strong>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {PAYMENT_CHIPS.map((chip) => (
            <li key={chip} className="rounded-full border border-[#cfe7d9] bg-white px-2 py-px text-xs">
              {t(`payment.${chip}`)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function ServiceIcon({ icon }: { icon: IconName }) {
  return (
    <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
      <Icon name={icon} />
    </span>
  );
}
