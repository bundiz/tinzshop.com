import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wpCategoryListSchema, wpPostListSchema, wpPostSchema } from "./schemas";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8"));
}

describe("WordPress schemas", () => {
  it("accepts the saved posts and categories", () => {
    expect(wpPostListSchema.parse(fixture("posts-page.json"))).toHaveLength(2);
    expect(wpCategoryListSchema.parse(fixture("categories.json"))).toHaveLength(13);
  });

  it("zod rejects a post without id", () => {
    const [post] = wpPostListSchema.parse(fixture("posts-page.json"));
    const { id: _omitted, ...withoutId } = post ?? {};
    const result = wpPostSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "id")).toBe(true);
  });

  it("rejects a GMT date that is not WordPress's format", () => {
    const [post] = wpPostListSchema.parse(fixture("posts-page.json"));
    expect(wpPostSchema.safeParse({ ...post, date_gmt: "yesterday" }).success).toBe(false);
  });
});
