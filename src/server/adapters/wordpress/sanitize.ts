import sanitizeHtml from "sanitize-html";

/** The product card placeholder's tag (D-245): `<tinz-product data-id="…"></tinz-product>`. Browser-safe: no server imports. */
export const PRODUCT_CARD_TAG = "tinz-product";

/** A product id as the database stores it: a uuid. Anything else is not a card. */
export const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Empties every card of already-sanitised (so balanced) HTML: whatever sat inside a card is dropped, and a card
 * inside a card goes with its parent. The element is only ever a placeholder, drawn from the live product at view time.
 */
function emptyProductCards(html: string): string {
  const tag = /<(\/?)tinz-product(\s[^>]*)?>/g;
  let out = "";
  let last = 0;
  let depth = 0;
  let openTag = "";
  for (let match = tag.exec(html); match !== null; match = tag.exec(html)) {
    const closing = match[1] === "/";
    if (depth === 0) {
      if (closing) continue;
      out += html.slice(last, match.index);
      openTag = match[0];
      depth = 1;
    } else {
      depth += closing ? -1 : 1;
      if (depth === 0) {
        out += `${openTag}</${PRODUCT_CARD_TAG}>`;
        last = match.index + match[0].length;
      }
    }
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
      img: ["src", "alt"],
      iframe: ["src", "allowfullscreen"],
      [PRODUCT_CARD_TAG]: ["data-id"],
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
      // An image whose src is not an absolute http/https URL loses it, and is then dropped below.
      img: (tagName, attribs) => {
        const { src, ...rest } = attribs;
        return absoluteHttpUrl(src) === null
          ? { tagName, attribs: rest }
          : { tagName, attribs: { ...attribs, src: src?.trim() ?? "" } };
      },
      // A card keeps `data-id` only when it is a uuid, and nothing else; without one it is dropped below.
      [PRODUCT_CARD_TAG]: (tagName, attribs) => {
        const id = attribs["data-id"]?.trim().toLowerCase();
        const kept: sanitizeHtml.Attributes = {};
        if (id !== undefined && PRODUCT_ID_PATTERN.test(id)) kept["data-id"] = id;
        return { tagName, attribs: kept };
      },
      iframe: (tagName, attribs) => {
        embedsSeen += 1;
        const src = youTubeEmbedSrc(attribs.src);
        const kept: Record<string, string> = src === null ? {} : { src };
        if (src !== null && "allowfullscreen" in attribs) kept.allowfullscreen = "";
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
      // An image whose src was refused would render as a broken image.
      return frame.tag === "img" && frame.attribs.src === undefined;
    },
  });

  return { html: emptyProductCards(clean), removedEmbeds: embedsSeen - iframesKept };
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
