import { z } from "zod";

/** A WordPress id: a non-negative safe integer (0 means "none" for featured_media and parent). */
const wpId = z.number().int().nonnegative().refine(Number.isSafeInteger, "id is not a safe integer");

/** WordPress's GMT time, written without a zone: `2025-10-23T16:16:00`. */
const wpGmtDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "not a WordPress GMT date");

const rendered = z.looseObject({ rendered: z.string() });

export const wpPostSchema = z.looseObject({
  id: wpId.refine((n) => n > 0, "id must be positive"),
  date_gmt: wpGmtDate,
  modified_gmt: wpGmtDate,
  slug: z.string().min(1),
  link: z.string().url(),
  title: rendered,
  excerpt: rendered,
  content: rendered,
  categories: z.array(wpId),
  featured_media: wpId,
  author: wpId,
});

export const wpPostListSchema = z.array(wpPostSchema);

export const wpCategorySchema = z.looseObject({
  id: wpId.refine((n) => n > 0, "id must be positive"),
  parent: wpId,
  count: z.number().int().nonnegative(),
  slug: z.string().min(1),
  name: z.string(),
});

export const wpCategoryListSchema = z.array(wpCategorySchema);

export const wpUserListSchema = z.array(
  z.looseObject({
    id: wpId,
    name: z.string(),
  }),
);

export const wpMediaSchema = z.looseObject({
  source_url: z.string().url(),
});

export type WpPost = z.infer<typeof wpPostSchema>;
export type WpCategory = z.infer<typeof wpCategorySchema>;
