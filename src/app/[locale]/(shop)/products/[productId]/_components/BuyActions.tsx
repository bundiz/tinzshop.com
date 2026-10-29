import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';

/**
 * The lower half of the design's buy box: the quantity stepper, "add to cart" and "buy now", and the
 * wishlist and share links. There is no cart yet (plan 003), so every control renders as designed and does
 * nothing: buttons are `type="button"`, the quantity stays at 1 and the links point to `#` (D-124).
 */
export default function BuyActions() {
  const t = useTranslations('shop.product');
  const stepper =
    'grid size-11 cursor-pointer place-items-center border-0 bg-bg text-lg hover:bg-primary-soft hover:text-primary';
  const action =
    'inline-flex min-h-[50px] cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-3 text-base leading-[1.3] font-bold whitespace-nowrap transition-colors';

  return (
    <>
      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <label htmlFor="quantity" className="text-sm text-text-muted">
          {t('quantity.label')}
        </label>
        <div className="inline-flex items-center overflow-hidden rounded-full border border-border">
          <button type="button" aria-label={t('quantity.decrease')} className={stepper}>
            −
          </button>
          <input
            id="quantity"
            type="text"
            inputMode="numeric"
            defaultValue="1"
            readOnly
            className="h-11 w-12 border-0 border-x border-border text-center font-bold"
          />
          <button type="button" aria-label={t('quantity.increase')} className={stepper}>
            +
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button type="button" className={`${action} bg-primary text-white hover:bg-primary-dark`}>
          <Icon name="cart" className="hidden size-5 xs:block" />
          {t('addToCart')}
        </button>
        <button type="button" className={`${action} bg-accent text-text hover:bg-accent-dark`}>
          {t('buyNow')}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-[18px] text-[13px] text-text-muted">
        <a href="#" className="inline-flex min-h-9 items-center gap-1.5 hover:text-primary">
          <Icon name="heart" className="size-4" />
          {t('wishlist.add')}
        </a>
        <a href="#" className="inline-flex min-h-9 items-center gap-1.5 hover:text-primary">
          <Icon name="share" className="size-4" />
          {t('share')}
        </a>
      </div>
    </>
  );
}
