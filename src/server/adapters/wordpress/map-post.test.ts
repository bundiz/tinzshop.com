import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapWordPressCategory, mapWordPressPost } from "./map-post";
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

describe("mapWordPressCategory", () => {
  it("maps a child category with a decoded Thai slug", () => {
    const category = categories.find((c) => c.id === 45);
    if (category === undefined) throw new Error("fixture category 45 missing");
    expect(mapWordPressCategory(category)).toEqual({
      sourceId: 45n,
      parentSourceId: 5n,
      slug: "บทความ",
      translation: { locale: "th", name: "บทความ" },
    });
  });

  it("maps a top-level category with no parent", () => {
    const category = categories.find((c) => c.id === 5);
    if (category === undefined) throw new Error("fixture category 5 missing");
    expect(mapWordPressCategory(category)).toEqual({
      sourceId: 5n,
      parentSourceId: null,
      slug: "news",
      translation: { locale: "th", name: "News" },
    });
  });
});
