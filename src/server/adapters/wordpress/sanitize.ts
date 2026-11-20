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
/** Full width: the default, never stored (a card, video or uploaded image at 100% has no `data-width`). */
export const MAX_EMBED_WIDTH = 100;

/**
 * The embed width stored in `data-width` on a product card, a YouTube iframe (D-273) or an uploaded image (D-283): a
 * whole number from 40 to 99 written as plain digits, or null for anything else (absent, 100, under 40, a percentage, a
 * decimal, a leading zero, spaces). The sanitiser, the editor and the article page all read it through this one rule.
 */
export function parseEmbedWidth(value: string | null | undefined): number | null {
  if (value === null || value === undefined || !/^[1-9][0-9]$/.test(value)) return null;
  const width = Number(value);
  return width >= MIN_EMBED_WIDTH && width < MAX_EMBED_WIDTH ? width : null;
}

/** The text alignments a paragraph or a heading may carry (D-286); left is the default and the editor writes none for it. */
export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/**
 * A `style` attribute's declarations, split at each `;` that is outside quotes and brackets, so a `;` inside a quoted
 * value or a `url(…)` never starts a declaration of its own. Each is `[property, value]`, both trimmed and as written.
 */
function styleDeclarations(style: string): [string, string][] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let depth = 0;
  for (const character of style) {
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.flatMap((part) => {
    const colon = part.indexOf(":");
    return colon === -1 ? [] : [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string]];
  });
}

/**
 * The text alignment of a `style` attribute (D-286): its last `text-align` declaration, as the browser reads it, when
 * that is exactly `left`, `center` or `right` (lower case, nothing else in the value: no `!important`, comment, escape or
 * quote); otherwise null. The sanitiser, the editor's guard and nothing else read a stored style, all through this rule.
 */
export function parseTextAlign(style: string | null | undefined): TextAlignment | null {
  if (style === null || style === undefined) return null;
  let value: string | null = null;
  for (const [property, declared] of styleDeclarations(style)) if (property === "text-align") value = declared;
  return (TEXT_ALIGNMENTS as readonly string[]).includes(value ?? "") ? (value as TextAlignment) : null;
}

/** An uploaded image's alignment (D-286): `left` floats it with the text round it; centred is the default and stores nothing. */
export const IMAGE_ALIGN_LEFT = "left";

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
 * event handler and other attribute — is stripped, except a text alignment on a paragraph or heading (D-286). A disallowed tag's text is kept; a script's or
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

/** The elements that may carry a text alignment (D-286): paragraphs and headings. */
const ALIGNABLE_TAGS = ["p", "h1", "h2", "h3", "h4", "h5", "h6"];

/**
 * A paragraph's or heading's attributes reduced to its text alignment (D-286): `style="text-align: X;"` when its style
 * holds one `parseTextAlign` accepts, written exactly as the editor writes it (so an aligned body round-trips byte for
 * byte), and nothing otherwise.
 */
const alignText: sanitizeHtml.Transformer = (tagName, attribs) => {
  const align = parseTextAlign(attribs.style);
  const kept: sanitizeHtml.Attributes = {};
  if (align !== null) kept.style = `text-align: ${align};`;
  return { tagName, attribs: kept };
};

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
      // Only a text alignment, rebuilt by `alignText` below as `text-align: …;` (D-286).
      ...Object.fromEntries(ALIGNABLE_TAGS.map((tag) => [tag, ["style"]])),
      img: ["src", "alt", "data-media-key", "data-width", "data-align"],
      iframe: ["src", "allowfullscreen", "data-width"],
      [PRODUCT_CARD_TAG]: ["data-id", "data-width"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: [...YOUTUBE_EMBED_HOSTS],
    allowIframeRelativeUrls: false,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "object", "embed"],
    // The only style that survives is the one `alignText` writes, from a fixed set of strings, so it needs no CSS parser
    // (sanitize-html's needs postcss, which does not run in the browser, where the editor's guard runs this same code).
    parseStyleAttributes: false,
    transformTags: {
      ...Object.fromEntries(ALIGNABLE_TAGS.map((tag) => [tag, alignText])),
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
          // Only an uploaded image can be resized (D-283): its width as on a card or a video (D-273).
          const width = parseEmbedWidth(attribs["data-width"]);
          if (width !== null) keyed["data-width"] = String(width);
          // And only an uploaded image can be aligned left (D-286), written last.
          if (attribs["data-align"] === IMAGE_ALIGN_LEFT) keyed["data-align"] = IMAGE_ALIGN_LEFT;
          return { tagName, attribs: keyed };
        }
        // Copied so the attributes keep their order (an imported image's output is unchanged); an imported image is never
        // resized or aligned, so it keeps no `data-width` and no `data-align`.
        const kept: sanitizeHtml.Attributes = { ...attribs };
        delete kept["data-media-key"];
        delete kept["data-width"];
        delete kept["data-align"];
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
