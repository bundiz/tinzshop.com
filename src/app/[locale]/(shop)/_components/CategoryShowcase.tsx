import { useTranslations } from 'next-intl';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';

type Tag = 'consoles' | 'games' | 'controllers' | 'keyboards' | 'mice' | 'headsets' | 'newGames' | 'newConsoles';

const ITEMS: {
  category: 'switch' | 'ps5' | 'gadgets' | 'preOrder';
  textKey: 'consolesText' | 'gadgetsText' | 'preOrderText';
  tone: 'warm' | 'deep' | 'cool' | 'default';
  tags: Tag[];
}[] = [
  { category: 'switch', textKey: 'consolesText', tone: 'warm', tags: ['consoles', 'games', 'controllers'] },
  { category: 'ps5', textKey: 'consolesText', tone: 'deep', tags: ['consoles', 'games', 'controllers'] },
  { category: 'gadgets', textKey: 'gadgetsText', tone: 'cool', tags: ['keyboards', 'mice', 'headsets'] },
  { category: 'preOrder', textKey: 'preOrderText', tone: 'default', tags: ['newGames', 'newConsoles'] },
];

/**
 * The design's "shop by category" tiles: four fixed categories with their tags. Static text from the
 * message catalogue; the links are inert until category pages exist (D-124).
 */
export default function CategoryShowcase() {
  const t = useTranslations('shop.home.showcase');
  const tCategory = useTranslations('shop.category');

  return (
    <section aria-labelledby="showcase-title" className="mt-4 rounded-(--radius) bg-bg p-4 md:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2
          id="showcase-title"
          className="flex items-center gap-2.5 text-[19px] before:h-5 before:w-1 before:shrink-0 before:rounded-[2px] before:bg-accent before:content-['']"
        >
          {t('title')}
        </h2>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ category, textKey, tone, tags }) => (
          <li
            key={category}
            className="grid grid-cols-[96px_1fr] items-center gap-3.5 rounded-(--radius) border border-border bg-bg p-3.5 transition-[border-color,box-shadow] duration-[180ms] hover:border-[#cbdcf7] hover:shadow-hover lg:grid-cols-[80px_minmax(0,1fr)]"
          >
            <ImagePlaceholder tone={tone} className="rounded-(--radius-sm)" />
            <div className="min-w-0">
              <h3 className="text-base">
                <a href="#" className="hover:text-primary">
                  {tCategory(category)}
                </a>
              </h3>
              <p className="text-[13px] leading-[1.5] text-text-subtle">{t(textKey)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <a
                    key={tag}
                    href="#"
                    className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs hover:bg-primary-soft hover:text-primary"
                  >
                    {t(`tag.${tag}`)}
                  </a>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
