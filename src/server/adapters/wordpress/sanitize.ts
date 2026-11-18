import sanitizeHtml from "sanitize-html";

/** The product card placeholder's tag (D-245): `<tinz-product data-id="…"></tinz-product>`. Browser-safe: no server imports. */
export const PRODUCT_CARD_TAG = "tinz-product";

/** A product id as the database stores it: a uuid. Anything else is not a card. */
export const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An uploaded news image's object key (plan 017, D-278): `news/{yyyy}/{mm}/{uuid}.{ext}`, the uuid a lower-case v4 and
 * the extension one of the four accepted types. Anchored, so `../`, a query, another prefix or a full URL never match.
 * Browser-safe: the sanitiser, the editor and the database CHECK share this one shape.
 */
export const NEWS_MEDIA_KEY_PATTERN =
  /^news\/[0-9]{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

export function isNewsMediaKey(value: string): boolean {
  return NEWS_MEDIA_KEY_PATTERN.test(value);
}

/** The longest alt text of an uploaded body image, in characters (plan 017 call 8). */
export const NEWS_IMAGE_ALT_MAX_LENGTH = 300;

/** The narrowest a product card or a video may be drawn, as a whole-number percentage of the article column (D-273). */
export const MIN_EMBED_WIDTH = 40;
/** Full width: the default, never stored (a card or video at 100% has no `data-width`). */
export const MAX_EMBED_WIDTH = 100;

/**
 * The embed width stored in `data-width` on a product card or a YouTube iframe (D-273): a whole number from 40 to 99
 * written as plain digits, or null for anything else (absent, 100, under 40, a percentage, a decimal, a leading zero,
 * spaces). The sanitiser, the editor and the article page all read it through this one rule.
 */
export function parseEmbedWidth(value: string | null | undefined): number | null {
  if (value === null || value === undefined || !/^[1-9][0-9]$/.test(value)) return null;
  const width = Number(value);
  return width >= MIN_EMBED_WIDTH && width < MAX_EMBED_WIDTH ? width : null;
}

/** A tag of already-sanitised HTML (sanitize-html escapes `<` and `>` inside attribute values, so this never splits one). */
const TAG = /<(\/?)([a-z][a-z0-9-]*)(\s[^>]*)?>/gi;
const VOID_TAGS = new Set(["br", "img"]);

/**
 * Keeps each product card only when it stands at the top level of the body (R16, D-245), and empties it: whatever sat
 * inside a card is dropped. A card inside any other element (a list item, a quote, a table cell, a paragraph, a bold run)
 * is dropped, because the article page cuts the body at each card and a cut inside an element would unbalance the rest.
 * Works on sanitize-html's balanced output, tracking depth.
 */
function keepTopLevelProductCards(html: string): string {
  let out = "";
  let last = 0;
  let depth = 0;
  let cardDepth = 0;
  let keep = false;
  let openTag = "";
  for (let match = TAG.exec(html); match !== null; match = TAG.exec(html)) {
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (name === PRODUCT_CARD_TAG) {
      if (cardDepth === 0) {
        if (closing) continue;
        keep = depth === 0;
        out += html.slice(last, match.index);
        openTag = match[0];
        cardDepth = 1;
      } else {
        cardDepth += closing ? -1 : 1;
        if (cardDepth === 0) {
          if (keep) out += `${openTag}</${PRODUCT_CARD_TAG}>`;
          last = match.index + match[0].length;
        }
      }
      continue;
    }
    if (cardDepth > 0) continue;
    if (closing) depth = Math.max(0, depth - 1);
    else if (!VOID_TAGS.has(name) && !match[0].endsWith("/>")) depth += 1;
  }
  return out + html.slice(last);
}

/**
 * The article body allow-list (spec 2026-10-29 §5, D-133). Everything else — every script, style,
 * event handler and other attribute — is stripped. A disallowed tag's text is kept; a script's or
 * style's is not.
 */
const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "blockquote",
  "strong",
  "em",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "iframe",
  PRODUCT_CARD_TAG,
];

/** Elements whose removal is counted, so a lost embed never disappears silently (spec §8 risk 2). */
const EMBED_TAGS = ["iframe", "script", "object", "embed"];

const YOUTUBE_EMBED_HOSTS = new Set(["www.youtube.com", "youtube.com"]);

/** The value as an absolute http/https URL, or null: relative, fragment and other-scheme values are refused. */
export function absoluteHttpUrl(value: string | undefined): URL | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** An http/https YouTube /embed/ URL, upgraded to https; null for anything else. */
function youTubeEmbedSrc(src: string | undefined): string | null {
  const url = absoluteHttpUrl(src);
  if (url === null || !YOUTUBE_EMBED_HOSTS.has(url.hostname) || !url.pathname.startsWith("/embed/")) {
    return null;
  }
  url.protocol = "https:";
  return url.href;
}

export function sanitizeArticleHtml(html: string): { html: string; removedEmbeds: number } {
  let embedsSeen = 0;
  let iframesKept = 0;

  const countEmbed: sanitizeHtml.Transformer = (tagName, attribs) => {
    embedsSeen += 1;
    return { tagName, attribs };
  };

  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel"],
      img: ["src", "alt", "data-media-key"],
      iframe: ["src", "allowfullscreen", "data-width"],
      [PRODUCT_CARD_TAG]: ["data-id", "data-width"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: [...YOUTUBE_EMBED_HOSTS],
    allowIframeRelativeUrls: false,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "object", "embed"],
    transformTags: {
      ...Object.fromEntries(EMBED_TAGS.map((tag) => [tag, countEmbed])),
      // A link whose href is not an absolute http/https URL loses it, and is then unwrapped below.
      a: (tagName, attribs) => {
        const kept: sanitizeHtml.Attributes = {};
        if (absoluteHttpUrl(attribs.href) !== null) {
          kept.href = attribs.href?.trim() ?? "";
          kept.rel = "noopener";
        }
        return { tagName, attribs: kept };
      },
      // An uploaded image (plan 017, D-277) keeps only a media key that matches exactly, and its alt: any src beside
      // it is dropped, since the page builds the URL from the key. Otherwise an image whose src is not an absolute
      // http/https URL loses it, and is then dropped below; a key that does not match is never kept.
      img: (tagName, attribs) => {
        const key = attribs["data-media-key"];
        if (key !== undefined && isNewsMediaKey(key)) {
          const keyed: sanitizeHtml.Attributes = { "data-media-key": key };
          if (attribs.alt !== undefined) keyed.alt = attribs.alt;
          return { tagName, attribs: keyed };
        }
        // Copied so the attributes keep their order (an imported image's output is unchanged).
        const kept: sanitizeHtml.Attributes = { ...attribs };
        delete kept["data-media-key"];
        if (absoluteHttpUrl(attribs.src) === null) delete kept.src;
        else kept.src = attribs.src?.trim() ?? "";
        return { tagName, attribs: kept };
      },
      // A card keeps `data-id` only when it is a uuid, and then a valid `data-width` (D-273), and nothing else; without an
      // id it is dropped below.
      [PRODUCT_CARD_TAG]: (tagName, attribs) => {
        const id = attribs["data-id"]?.trim().toLowerCase();
        const kept: sanitizeHtml.Attributes = {};
        if (id !== undefined && PRODUCT_ID_PATTERN.test(id)) {
          kept["data-id"] = id;
          const width = parseEmbedWidth(attribs["data-width"]);
          if (width !== null) kept["data-width"] = String(width);
        }
        return { tagName, attribs: kept };
      },
      iframe: (tagName, attribs) => {
        embedsSeen += 1;
        const src = youTubeEmbedSrc(attribs.src);
        const kept: Record<string, string> = src === null ? {} : { src };
        if (src !== null && "allowfullscreen" in attribs) kept.allowfullscreen = "";
        const width = parseEmbedWidth(attribs["data-width"]);
        if (src !== null && width !== null) kept["data-width"] = String(width);
        return { tagName, attribs: kept };
      },
    },
    exclusiveFilter: (frame) => {
      // A link without an accepted href keeps its text and loses the tag.
      if (frame.tag === "a" && frame.attribs.href === undefined) return "excludeTag";
      // A card without an accepted id is dropped whole, with whatever is inside it.
      if (frame.tag === PRODUCT_CARD_TAG) return frame.attribs["data-id"] === undefined;
      if (frame.tag === "iframe") {
        if (frame.attribs.src === undefined) return true;
        iframesKept += 1;
        return false;
      }
      // An image whose src was refused, and that has no media key, would render as a broken image.
      return frame.tag === "img" && frame.attribs.src === undefined && frame.attribs["data-media-key"] === undefined;
    },
  });

  return { html: keepTopLevelProductCards(clean), removedEmbeds: embedsSeen - iframesKept };
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** Decodes numeric entities and the common named ones WordPress emits; an unknown name is kept. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Markup removed, entities decoded, whitespace collapsed to single spaces. */
export function htmlToPlainText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

/** A percent-encoded slug decoded to text; a malformed one is returned as it came. */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
