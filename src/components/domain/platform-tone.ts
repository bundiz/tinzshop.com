export type PlatformTone = 'ps' | 'ns' | 'it' | 'other';

/** A platform category's slug to its colour family: tags, tints and dots (plan 015, `tag-ps` and kin). */
export const PLATFORM_TONE: Readonly<Record<string, PlatformTone>> = {
  'playstation-5': 'ps',
  'nintendo-switch': 'ns',
  'it-gadgets': 'it',
};

/** The tone of a platform slug; `null` (no platform) and any other slug are `other`. */
export function platformTone(slug: string | null): PlatformTone {
  if (slug === null) return 'other';
  return Object.hasOwn(PLATFORM_TONE, slug) ? PLATFORM_TONE[slug]! : 'other';
}
