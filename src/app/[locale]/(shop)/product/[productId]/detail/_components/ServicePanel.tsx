import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button-class';
import Icon, { type IconName } from '@/components/ui/Icon';

const ASSURANCES: { key: 'shipping' | 'warranty' | 'invoice' | 'cancel'; icon: IconName }[] = [
  { key: 'shipping', icon: 'truck' },
  { key: 'warranty', icon: 'shield' },
  { key: 'invoice', icon: 'receipt' },
  { key: 'cancel', icon: 'package' },
];

/**
 * The lower half of the buy box (the mockup's `.assure` and `.ask`): four assurances and the LINE ask block. The
 * LINE button is inert and carries no handle until the shop gives one (D-124); its text is ink on the LINE green (R16).
 */
export default function ServicePanel() {
  const t = useTranslations('shop.product');

  return (
    <>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {ASSURANCES.map(({ key, icon }) => (
          <li
            key={key}
            className="flex items-start gap-2.5 rounded-md border border-line bg-surface p-3.5 text-[14.5px] leading-normal"
          >
            <Icon name={icon} className="mt-0.5 size-5 flex-none text-brand" />
            <p className="min-w-0">
              <b className="block text-[15px] font-semibold">{t(`assure.${key}.title`)}</b>
              <span className="text-muted">{t(`assure.${key}.text`)}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-line-app-soft px-4 py-3.5 text-[15px]">
        <p className="min-w-0">
          <b className="block font-semibold">{t('ask.title')}</b>
          {t('ask.text')}
        </p>
        <a href="#" className={`${buttonClass({ variant: 'lineApp' })} flex-none`}>
          <Icon name="chat" className="size-5" />
          {t('ask.button')}
        </a>
      </div>
    </>
  );
}
