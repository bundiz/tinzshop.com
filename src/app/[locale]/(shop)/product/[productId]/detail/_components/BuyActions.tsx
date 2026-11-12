import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';

/**
 * The buy row of the buy box: the quantity stepper, "add to cart" and "buy now". There is no cart yet (plan 003),
 * so every control renders as designed and does nothing: buttons are `type="button"` and the quantity stays at 1
 * (D-124). The wishlist and share links are not in the redesign (D-198).
 */
export default function BuyActions() {
  const t = useTranslations('shop.product');
  const step =
    'h-full w-[46px] cursor-pointer rounded-sm border-0 bg-transparent text-xl transition-colors hover:bg-sunk';

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_1fr]">
      <div className="col-span-full inline-flex h-[54px] items-center justify-self-start rounded-sm border-[1.5px] border-line-2 bg-white sm:col-span-1">
        <button type="button" aria-label={t('quantity.decrease')} className={step}>
          −
        </button>
        <label htmlFor="quantity" className="sr-only">
          {t('quantity.label')}
        </label>
        <input
          id="quantity"
          type="text"
          inputMode="numeric"
          defaultValue="1"
          readOnly
          className="w-11 border-0 bg-transparent text-center text-base font-semibold outline-none"
        />
        <button type="button" aria-label={t('quantity.increase')} className={step}>
          +
        </button>
      </div>
      <button type="button" className={buttonClass({ variant: 'brand', size: 'lg' })}>
        <Icon name="cart" className="size-5" />
        {t('addToCart')}
      </button>
      <button type="button" className={buttonClass({ variant: 'buy', size: 'lg' })}>
        {t('buyNow')}
      </button>
    </div>
  );
}
