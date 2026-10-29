-- Data migration (plan 013, ruling R5, D-149): seeds the fixed category tree of D-143, the same rows as
-- `CATEGORY_TREE` in src/server/services/catalogue/categorise-by-name.ts (a unit test keeps the two equal).
-- Idempotent: an existing slug or translation (maybe edited by an admin) is left as it is, as the
-- categorise job's own upsert does.

-- Platforms (top level), in the design's order.
INSERT INTO "category" ("slug", "parent_id", "position")
VALUES
  ('nintendo-switch', NULL, 1),
  ('playstation-5', NULL, 2),
  ('it-gadgets', NULL, 3)
ON CONFLICT ("slug") DO NOTHING;

-- Product types, the children of each platform.
INSERT INTO "category" ("slug", "parent_id", "position")
SELECT seed.slug, parent.id, seed.position
FROM (VALUES
  ('nintendo-switch-console', 'nintendo-switch', 1),
  ('nintendo-switch-game', 'nintendo-switch', 2),
  ('nintendo-switch-controller', 'nintendo-switch', 3),
  ('nintendo-switch-accessory', 'nintendo-switch', 4),
  ('playstation-5-console', 'playstation-5', 1),
  ('playstation-5-game', 'playstation-5', 2),
  ('playstation-5-controller', 'playstation-5', 3),
  ('playstation-5-accessory', 'playstation-5', 4),
  ('it-gadgets-accessory', 'it-gadgets', 1)
) AS seed (slug, parent_slug, position)
JOIN "category" parent ON parent.slug = seed.parent_slug
ON CONFLICT ("slug") DO NOTHING;

-- Names in Thai and English.
INSERT INTO "category_translation" ("category_id", "locale", "name")
SELECT c.id, seed.locale::"locale", seed.name
FROM (VALUES
  ('nintendo-switch', 'th', 'Nintendo Switch'),
  ('nintendo-switch', 'en', 'Nintendo Switch'),
  ('nintendo-switch-console', 'th', 'เครื่องเกม'),
  ('nintendo-switch-console', 'en', 'Consoles'),
  ('nintendo-switch-game', 'th', 'แผ่นเกม'),
  ('nintendo-switch-game', 'en', 'Games'),
  ('nintendo-switch-controller', 'th', 'จอย'),
  ('nintendo-switch-controller', 'en', 'Controllers'),
  ('nintendo-switch-accessory', 'th', 'อุปกรณ์เสริม'),
  ('nintendo-switch-accessory', 'en', 'Accessories'),
  ('playstation-5', 'th', 'PlayStation 5'),
  ('playstation-5', 'en', 'PlayStation 5'),
  ('playstation-5-console', 'th', 'เครื่องเกม'),
  ('playstation-5-console', 'en', 'Consoles'),
  ('playstation-5-game', 'th', 'แผ่นเกม'),
  ('playstation-5-game', 'en', 'Games'),
  ('playstation-5-controller', 'th', 'จอย'),
  ('playstation-5-controller', 'en', 'Controllers'),
  ('playstation-5-accessory', 'th', 'อุปกรณ์เสริม'),
  ('playstation-5-accessory', 'en', 'Accessories'),
  ('it-gadgets', 'th', 'IT Gadgets'),
  ('it-gadgets', 'en', 'IT Gadgets'),
  ('it-gadgets-accessory', 'th', 'อุปกรณ์เสริม'),
  ('it-gadgets-accessory', 'en', 'Accessories')
) AS seed (slug, locale, name)
JOIN "category" c ON c.slug = seed.slug
ON CONFLICT ("category_id", "locale") DO NOTHING;
