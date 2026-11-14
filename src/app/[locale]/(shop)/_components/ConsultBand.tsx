import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';

/**
 * The LINE consult band (the mockup's `.consult`). Both buttons are inert: the shop's LINE account and a FAQ
 * page are not known yet (D-124), so there is no handle and no sample chat (Q-068, Q-069). The big word
 * "LINE" is decoration. The LINE button carries ink text on the LINE green (R16).
 */
export default function ConsultBand() {
  const t = useTranslations('shop.home.consult');
  const cta = 'w-full sm:w-auto';

  return (
    <section aria-labelledby="consult-title" className="wrap pt-[clamp(48px,6vw,80px)]">
      <div className="relative grid grid-cols-1 items-center gap-10 overflow-hidden rounded-2xl bg-navy p-[clamp(28px,4vw,56px)] text-on-navy lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="inline-flex items-center gap-2 text-[13px] leading-none font-semibold tracking-[.06em] text-on-navy-2 uppercase">
            {t('eyebrow')}
          </p>
          <h2 id="consult-title" className="mt-3 text-[clamp(28px,3vw,40px)] font-bold text-white">
            {t('title')}
          </h2>
          <p className="mt-3.5 max-w-[32em] text-on-navy-2">{t('text')}</p>
          <div className="mt-[26px] flex flex-wrap gap-3">
            <a href="#" className={`${buttonClass({ variant: 'lineApp', size: 'lg' })} ${cta}`}>
              <Icon name="chat" />
              {t('line')}
            </a>
            <a href="#" className={`${buttonClass({ variant: 'ghost', size: 'lg' })} ${cta}`}>
              {t('faq')}
            </a>
          </div>
        </div>
        <p
          aria-hidden="true"
          className="font-head text-[44px] leading-none font-bold tracking-[-.03em] whitespace-nowrap text-white sm:text-[clamp(44px,6.4vw,92px)]"
        >
          {t('word')}
        </p>
      </div>
    </section>
  );
}
