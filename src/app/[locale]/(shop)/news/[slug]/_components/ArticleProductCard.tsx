import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

/**
 * A product inside an article, drawn from the live product at view time (D-245): image, name, current price and stock
 * status, in the storefront `ProductCard`'s panel, set side by side so it reads as part of the text. The whole card links
 * to `/{locale}/product/{id}/detail`; that page asks for sign-in (plan 014), so a signed-out reader is sent through the
 * existing sign-in flow and back. No wishlist heart and no cart button: both are inert until a wishlist and a cart exist.
 */
export default function ArticleProductCard({ card }: { card: LandingProductCard }) {
  const t = useTranslations('shop.product');
  const locale = useLocale();
  const isOut = card.stockStatus === 'out_of_stock';

  return (
    <article className="group relative my-5 flex gap-3 rounded-[14px] border border-line bg-surface p-2 transition-[transform,box-shadow,border-color] duration-[220ms] ease-soft hover:border-transparent hover:shadow-2 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ps sm:rounded-lg sm:p-3">
      <div className={`w-[96px] flex-none self-start overflow-hidden rounded-md bg-surface sm:w-[140px] ${isOut ? 'opacity-70 grayscale-[.9]' : ''}`}>
        {card.imageUrl !== null ? (
          // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
          <img src={card.imageUrl} alt="" loading="lazy" className="aspect-square w-full bg-surface object-contain" />
        ) : (
          <ImagePlaceholder label={t('imagePlaceholderAlt')} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1 py-1">
        <h3 className="line-clamp-2 font-body text-[15px] leading-[1.45] font-semibold [overflow-wrap:anywhere] sm:text-base">
          <Link
            href={`/${locale}/product/${card.productId}/detail`}
            className="no-underline after:absolute after:inset-0 after:z-[2] after:rounded-[inherit] after:content-[''] focus-visible:outline-none"
          >
            {card.name}
          </Link>
        </h3>
        <div className="mt-auto pt-1.5">
          <PriceDisplay satang={card.priceSatang} original={card.originalPriceSatang} isRange={card.isPriceRange} />
        </div>
        <StockBadge status={card.stockStatus} />
      </div>
    </article>
  );
}
