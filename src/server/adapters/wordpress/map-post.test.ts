import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEWS_CATEGORY_SLUG_RULES, mapWordPressCategories, mapWordPressPost } from "./map-post";
import { wpCategoryListSchema, wpPostListSchema } from "./schemas";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8"));
}

const posts = wpPostListSchema.parse(fixture("posts-page.json"));
const categories = wpCategoryListSchema.parse(fixture("categories.json"));

describe("mapWordPressPost", () => {
  it("maps a real fixture post", () => {
    const post = posts.find((p) => p.id === 5492);
    if (post === undefined) throw new Error("fixture post 5492 missing");
    const mediaUrl = "https://www.tinzshop.com/wp-content/uploads/2025/10/Assassins-Creed-Shadows-Switch-2-az.jpg";

    const snapshot = mapWordPressPost(post, mediaUrl, "Author One");

    expect(snapshot.sourceId).toBe(5492n);
    expect(snapshot.slug).toBe("assassin-creed-shadow-switch-2-all");
    expect(snapshot.sourceUrl).toBe(
      "https://www.tinzshop.com/nintendo-switch-2/assassin-creed-shadow-switch-2-all/",
    );
    expect(snapshot.status).toBe("published");
    expect(snapshot.publishedAt).toEqual(new Date(Date.UTC(2025, 9, 23, 16, 16, 0)));
    expect(snapshot.sourceModifiedAt).toEqual(new Date(Date.UTC(2025, 9, 23, 16, 16, 0)));
    expect(snapshot.categorySourceIds).toEqual([150n, 5n]);
    expect(snapshot.featuredImageUrl).toBe(mediaUrl);
    expect(snapshot.bylineName).toBe("Author One");
    expect(snapshot.translation.locale).toBe("th");
    expect(snapshot.translation.title).toBe("Assassin Creed Shadows บน Nintendo Switch 2 วางขาย 2 ธันวาคม 2025");
    expect(snapshot.translation.excerpt).toBe(
      "ข่าวดีสำหรับแฟนนักฆ่า เพราะเกม Assassin Creed Shadows เวอร์ชัน Nintendo Switch 2 ล่าสุดปู่นินได้ปล่อยตัวอย่างแรกพร้อมประกาศวันวางขายแล้ว",
    );
    expect(snapshot.translation.bodyHtml).toContain('<iframe src="https://www.youtube.com/embed/');
    expect(snapshot.translation.bodyHtml).not.toMatch(/class=|srcset=/);
    expect(snapshot.removedEmbeds).toBe(0);
  });

  it("decodes a Thai slug, keeps the modified time apart and leaves a missing byline null", () => {
    const post = posts.find((p) => p.id === 479);
    if (post === undefined) throw new Error("fixture post 479 missing");

    const snapshot = mapWordPressPost(post, null, null);

    expect(snapshot.slug).toBe("การผจญภัยครั้งใหม่ในโล");
    expect(snapshot.publishedAt).toEqual(new Date(Date.UTC(2025, 2, 19, 9, 11, 25)));
    expect(snapshot.sourceModifiedAt).toEqual(new Date(Date.UTC(2025, 2, 20, 3, 49, 28)));
    expect(snapshot.categorySourceIds).toEqual([5n, 14n]);
    expect(snapshot.featuredImageUrl).toBeNull();
    expect(snapshot.bylineName).toBeNull();
  });

  it("decodes HTML entities in the title", () => {
    const post = posts.find((p) => p.id === 5492);
    if (post === undefined) throw new Error("fixture post 5492 missing");
    const snapshot = mapWordPressPost(
      { ...post, title: { rendered: "Assassin&#8217;s Creed &amp; Friends" } },
      null,
      null,
    );
    expect(snapshot.translation.title).toBe("Assassin’s Creed & Friends");
  });
});

describe("mapWordPressCategories", () => {
  const mapped = mapWordPressCategories(categories);
  const bySourceId = (id: bigint) => {
    const found = mapped.find((c) => c.sourceId === id);
    if (found === undefined) throw new Error(`category ${id} missing`);
    return found;
  };

  it("maps a child category with a decoded Thai slug", () => {
    expect(bySourceId(45n)).toEqual({
      sourceId: 45n,
      parentSourceId: 5n,
      slug: "บทความ",
      translation: { locale: "th", name: "บทความ" },
      isListed: true,
      isExcluded: false,
    });
  });

  it("maps a top-level category with no parent", () => {
    expect(bySourceId(5n)).toEqual({
      sourceId: 5n,
      parentSourceId: null,
      slug: "news",
      translation: { locale: "th", name: "News" },
      isListed: true,
      isExcluded: false,
    });
  });

  it("lists the reviews subtree: staff product reviews are news (D-140)", () => {
    for (const id of [7n, 15n, 17n]) {
      expect(bySourceId(id)).toMatchObject({ isExcluded: false, isListed: true });
    }
    expect(mapped.filter((c) => c.isExcluded)).toEqual([]);
  });

  it("marks uncategorized unlisted but not excluded", () => {
    expect(bySourceId(1n)).toMatchObject({ slug: "uncategorized", isListed: false, isExcluded: false });
  });

  // The excluded mechanism stays for a future exclusion; it is exercised with a fixture slug.
  const FIXTURE_RULES = { excluded: ["not-news"], unlisted: ["uncategorized"] };

  it("marks an excluded subtree excluded and unlisted", () => {
    const list = [
      { id: 7, parent: 0, count: 0, slug: "not-news", name: "Not news" },
      { id: 15, parent: 7, count: 0, slug: "not-news-a", name: "A" },
      { id: 5, parent: 0, count: 0, slug: "news", name: "News" },
    ];
    expect(mapWordPressCategories(list, FIXTURE_RULES).map((c) => [c.sourceId, c.isExcluded, c.isListed])).toEqual([
      [7n, true, false],
      [15n, true, false],
      [5n, false, true],
    ]);
  });

  it("excludes a grandchild of an excluded category, whatever the list order, and survives a parent cycle", () => {
    const list = [
      { id: 90, parent: 15, count: 0, slug: "deep", name: "Deep" },
      { id: 15, parent: 7, count: 0, slug: "not-news-a", name: "A" },
      { id: 7, parent: 0, count: 0, slug: "not-news", name: "Not news" },
      { id: 61, parent: 62, count: 0, slug: "cycle-a", name: "A" },
      { id: 62, parent: 61, count: 0, slug: "cycle-b", name: "B" },
    ];
    expect(mapWordPressCategories(list, FIXTURE_RULES).map((c) => [c.sourceId, c.isExcluded])).toEqual([
      [90n, true],
      [15n, true],
      [7n, true],
      [61n, false],
      [62n, false],
    ]);
  });

  it("keeps the slug rules in one constant", () => {
    expect(NEWS_CATEGORY_SLUG_RULES).toEqual({ excluded: [], unlisted: ["uncategorized"] });
  });
});
