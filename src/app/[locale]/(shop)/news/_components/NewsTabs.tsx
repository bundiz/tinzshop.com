import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { NewsTab } from "@/server/services/news/news-read-service";
import NewsTabsScroller from "./NewsTabsScroller";
import { newsCategoryPath, newsListPath } from "../news-routes";

export type NewsTabsProps = {
  /** Categories with live articles, most first, each with its count. */
  categories: NewsTab[];
  /** The category being shown, or null on the list of every article ("ทั้งหมด"). */
  activeCategorySlug: string | null;
};

const TAB =
  "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 text-[14.5px] font-medium sm:min-h-10";
const ACTIVE = "border-brand bg-brand text-white";
const IDLE = "border-line-2 bg-surface hover:border-ink";

/** The mockup's `.chip`s: "all" plus each category with its article count; the current one is marked. */
export default function NewsTabs({
  categories,
  activeCategorySlug,
}: NewsTabsProps) {
  const t = useTranslations("shop.news.tabs");
  const locale = useLocale();

  const tab = (
    key: string,
    href: string,
    isActive: boolean,
    label: string,
    count?: number,
  ) => (
    <li key={key}>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`${TAB} ${isActive ? ACTIVE : IDLE}`}
      >
        {label}
        {count !== undefined && (
          <span className={`text-xs ${isActive ? "text-white/80" : "text-muted"}`}>{count}</span>
        )}
      </Link>
    </li>
  );

  return (
    <nav aria-label={t("label")} className="min-w-0">
      <NewsTabsScroller prevLabel={t("scrollPrev")} nextLabel={t("scrollNext")}>
        <ul className="flex gap-2">
          {tab(
            "all",
            newsListPath(locale),
            activeCategorySlug === null,
            t("all"),
          )}
          {categories.map((category) =>
            tab(
              category.slug,
              newsCategoryPath(locale, category.slug),
              category.slug === activeCategorySlug,
              category.name,
              category.count,
            ),
          )}
        </ul>
      </NewsTabsScroller>
    </nav>
  );
}
