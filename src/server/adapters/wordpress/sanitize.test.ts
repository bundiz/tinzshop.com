import { describe, expect, it } from "vitest";
import posts from "./__fixtures__/posts-page.json";
import { decodeHtmlEntities, decodeSlug, htmlToPlainText, parseEmbedWidth, sanitizeArticleHtml } from "./sanitize";

describe("sanitizeArticleHtml", () => {
  it("sanitises the body to the allow-list", () => {
    const hostile = [
      '<h2 class="wp-block-heading" style="color:red">Title</h2>',
      '<p onclick="steal()" id="x">Hello <strong>bold</strong> <em>it</em><span>span text</span></p>',
      "<script>alert(1)</script>",
      "<style>p { color: red }</style>",
      '<img src="x.png" onerror="alert(1)">',
      '<img src="javascript:alert(1)" alt="bad">',
      '<a href="javascript:alert(1)">js link</a>',
      '<a href="//evil.test/x">protocol relative</a>',
      '<a href="https://ok.test/page" target="_blank" onmouseover="x()">ok link</a>',
      '<iframe src="https://evil.test/embed/abc"></iframe>',
      '<iframe src="https://www.youtube.com/watch?v=abc"></iframe>',
      '<object data="https://evil.test/x.swf"></object>',
      '<form action="https://evil.test"><input name="q"></form>',
      '<div data-x="1"><ul><li>one</li></ul><ol><li>two</li></ol></div>',
      "<blockquote>quote</blockquote>",
      "<table><tbody><tr><td>cell</td></tr></tbody></table>",
    ].join("");

    const { html, removedEmbeds } = sanitizeArticleHtml(hostile);

    expect(html).not.toMatch(/<script|<style|<object|<form|<input|<div|<span/i);
    expect(html).not.toMatch(/alert|steal|color: ?red/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/evil\.test/);
    expect(html).not.toMatch(/<iframe/);
    expect(html).not.toMatch(/\s(class|style|id|target|data-x)=/);
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<p>Hello <strong>bold</strong> <em>it</em>span text</p>");
    expect(html).toContain('<a href="https://ok.test/page" rel="noopener">ok link</a>');
    expect(html).toContain("js link");
    expect(html).toContain("<ul><li>one</li></ul><ol><li>two</li></ol>");
    expect(html).toContain("<blockquote>quote</blockquote>");
    expect(html).toContain("<table><tbody><tr><td>cell</td></tr></tbody></table>");
    // script + two rejected iframes + object
    expect(removedEmbeds).toBe(4);
  });

  it("keeps YouTube iframes and images", () => {
    const input =
      '<figure class="wp-block-embed"><div class="wrapper"><iframe loading="lazy" title="Trailer" width="720" height="405" ' +
      'src="https://www.youtube.com/embed/3oTfnzXb8OE?feature=oembed" frameborder="0" allowfullscreen></iframe></div>' +
      "<figcaption>Trailer</figcaption></figure>" +
      '<figure><img loading="lazy" width="1024" src="https://www.tinzshop.com/wp-content/uploads/a.jpg" alt="A game" ' +
      'class="wp-image-1" srcset="https://www.tinzshop.com/wp-content/uploads/a-300.jpg 300w"></figure>';

    const { html, removedEmbeds } = sanitizeArticleHtml(input);

    expect(html).toContain(
      '<iframe src="https://www.youtube.com/embed/3oTfnzXb8OE?feature=oembed" allowfullscreen></iframe>',
    );
    expect(html).toContain(
      '<img src="https://www.tinzshop.com/wp-content/uploads/a.jpg" alt="A game" />',
    );
    expect(html).toContain("<figcaption>Trailer</figcaption>");
    expect(html).not.toMatch(/srcset|loading|width|class/);
    expect(removedEmbeds).toBe(0);
  });
});

describe("sanitizeArticleHtml URL rules", () => {
  it("unwraps a link with a relative href", () => {
    expect(sanitizeArticleHtml('<p><a href="/x">relative</a></p>').html).toBe("<p>relative</p>");
  });

  it("unwraps a link with a fragment href", () => {
    expect(sanitizeArticleHtml('<p><a href="#x">fragment</a></p>').html).toBe("<p>fragment</p>");
  });

  it("drops an image with a relative src", () => {
    expect(sanitizeArticleHtml('<p>a<img src="x.png" alt="x">b</p>').html).toBe("<p>ab</p>");
  });

  it("drops an image inside a template", () => {
    const { html } = sanitizeArticleHtml("<template><img src=x></template><p>after</p>");
    expect(html).not.toMatch(/<img|<template/);
    expect(html).toContain("<p>after</p>");
  });

  it("upgrades an http YouTube embed to https and normalises allowfullscreen", () => {
    const { html, removedEmbeds } = sanitizeArticleHtml(
      '<iframe src="http://www.youtube.com/embed/abc" allowfullscreen="true"></iframe>',
    );
    expect(html).toBe('<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>');
    expect(removedEmbeds).toBe(0);
  });

  it("removes and counts a youtube-nocookie embed", () => {
    const { html, removedEmbeds } = sanitizeArticleHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>',
    );
    expect(html).toBe("");
    expect(removedEmbeds).toBe(1);
  });
});

describe("htmlToPlainText", () => {
  it("turns the excerpt into plain text", () => {
    const excerpt =
      "<p>ข่าวดี &amp; <strong>เกมใหม่</strong>&nbsp;Assassin&#039;s Creed &#8211; มาแล้ว [&hellip;]</p>\n<script>x()</script>";
    expect(htmlToPlainText(excerpt)).toBe("ข่าวดี & เกมใหม่ Assassin's Creed – มาแล้ว […]");
  });
});

describe("decodeSlug", () => {
  it("decodes slugs", () => {
    expect(decodeSlug("%e0%b8%9a%e0%b8%97%e0%b8%84%e0%b8%a7%e0%b8%b2%e0%b8%a1")).toBe("บทความ");
    expect(decodeSlug("xenoblade-chronicles-x-%e0%b8%a3%e0%b8%b5")).toBe("xenoblade-chronicles-x-รี");
    expect(decodeSlug("horror-game")).toBe("horror-game");
    // A malformed escape is kept as it came, never thrown.
    expect(decodeSlug("bad-%e0%b8")).toBe("bad-%e0%b8");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes numeric and common named entities", () => {
    expect(decodeHtmlEntities("A &amp; B &#8217;s &#x2014; &quot;q&quot; &lt;x&gt; &unknown;")).toBe(
      "A & B ’s — \"q\" <x> &unknown;",
    );
  });
});

describe("sanitizeArticleHtml: the product card placeholder (D-245)", () => {
  const ID = "7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60";
  const CARD = `<tinz-product data-id="${ID}"></tinz-product>`;

  it("keeps a card with a uuid id, between paragraphs", () => {
    expect(sanitizeArticleHtml(`<p>a</p>${CARD}<p>b</p>`).html).toBe(`<p>a</p>${CARD}<p>b</p>`);
  });

  it("strips onclick and every other attribute, keeping only data-id", () => {
    const { html } = sanitizeArticleHtml(
      `<tinz-product data-id="${ID}" onclick="x()" class="c" style="color:red" data-other="1" href="https://x.test"></tinz-product>`,
    );
    expect(html).toBe(CARD);
  });

  it("drops a card whose id is not a uuid, or that has none", () => {
    for (const card of [
      '<tinz-product data-id="123"></tinz-product>',
      '<tinz-product data-id="<script>"></tinz-product>',
      "<tinz-product></tinz-product>",
      `<tinz-product data-id="${ID}x"></tinz-product>`,
    ]) {
      expect(sanitizeArticleHtml(`<p>a</p>${card}<p>b</p>`).html, card).toBe("<p>a</p><p>b</p>");
    }
  });

  it("keeps the element empty: children and text are dropped", () => {
    expect(
      sanitizeArticleHtml(`<tinz-product data-id="${ID}">hello <strong>b</strong><img src="https://x.test/a.png"></tinz-product>`).html,
    ).toBe(CARD);
    expect(
      sanitizeArticleHtml(`<tinz-product data-id="${ID}"><tinz-product data-id="${ID}"></tinz-product></tinz-product><p>z</p>`).html,
    ).toBe(`${CARD}<p>z</p>`);
  });

  it("leaves a body without cards unchanged", () => {
    const body = '<h2>T</h2><p>Text with tinz-product in it &lt;tinz-product&gt;</p>';
    expect(sanitizeArticleHtml(body).html).toBe(body);
  });

  it("drops a card that is not at the top level: in a list item, quote, table cell, paragraph or bold run (R16)", () => {
    for (const body of [
      `<ol><li>one</li><li>two${CARD}</li><li>three</li></ol>`,
      `<blockquote>q ${CARD}</blockquote>`,
      `<table><tbody><tr><td>a${CARD}</td></tr></tbody></table>`,
      `<p>a ${CARD} b</p>`,
      `<p><strong>a${CARD}</strong></p>`,
      `<figure>${CARD}</figure>`,
    ]) {
      expect(sanitizeArticleHtml(body).html, body).not.toContain("tinz-product");
    }
    // The rest of the structure is intact, and a top-level card after it stays.
    expect(sanitizeArticleHtml(`<ol><li>one</li><li>two${CARD}</li></ol>${CARD}<br><img src="https://x.test/a.png"><p>z</p>`).html).toBe(
      `<ol><li>one</li><li>two</li></ol>${CARD}<br /><img src="https://x.test/a.png" /><p>z</p>`,
    );
  });
});


describe("sanitizeArticleHtml: the embed width of a card or a video (D-273)", () => {
  const ID = "7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60";
  const SRC = "https://www.youtube.com/embed/dQw4w9WgXcQ";

  it("keeps a whole-number data-width from 40 to 99 on a card, after its id", () => {
    for (const width of ["40", "60", "99"]) {
      expect(sanitizeArticleHtml(`<tinz-product data-width="${width}" data-id="${ID}"></tinz-product>`).html, width).toBe(
        `<tinz-product data-id="${ID}" data-width="${width}"></tinz-product>`,
      );
    }
  });

  it("keeps a whole-number data-width from 40 to 99 on a YouTube iframe, after its other attributes", () => {
    expect(sanitizeArticleHtml(`<iframe data-width="75" src="${SRC}" allowfullscreen></iframe>`).html).toBe(
      `<iframe src="${SRC}" allowfullscreen data-width="75"></iframe>`,
    );
    expect(sanitizeArticleHtml(`<iframe src="${SRC}" data-width="40"></iframe>`).html).toBe(`<iframe src="${SRC}" data-width="40"></iframe>`);
  });

  it("drops any other data-width: 100, under 40, a percentage, a decimal, a leading zero, text, empty", () => {
    for (const width of ["100", "30", "39", "0", "60%", "60.5", "060", " 60", "abc", "", "-50", "1e2", "6O"]) {
      const card = sanitizeArticleHtml(`<tinz-product data-id="${ID}" data-width="${width}"></tinz-product>`).html;
      expect(card, width).toBe(`<tinz-product data-id="${ID}"></tinz-product>`);
      const video = sanitizeArticleHtml(`<iframe src="${SRC}" allowfullscreen data-width="${width}"></iframe>`).html;
      expect(video, width).toBe(`<iframe src="${SRC}" allowfullscreen></iframe>`);
    }
  });

  it("keeps it on no other element, and not on an iframe the sanitiser refuses", () => {
    const { html, removedEmbeds } = sanitizeArticleHtml(
      `<p data-width="60">a</p><img src="https://x.test/a.png" data-width="60"><figure data-width="60"><img src="https://x.test/b.png"></figure>` +
        `<iframe src="https://evil.test/embed/x" data-width="60"></iframe><table data-width="60"><tbody><tr><td>c</td></tr></tbody></table>`,
    );
    expect(html).not.toContain("data-width");
    expect(removedEmbeds).toBe(1);
  });

  it("adds nothing to an imported body: the fixture posts sanitise with no data-width", () => {
    for (const post of posts as { id: number; content: { rendered: string } }[]) {
      expect(sanitizeArticleHtml(post.content.rendered).html, String(post.id)).not.toContain("data-width");
    }
  });
});

describe("parseEmbedWidth (D-273)", () => {
  it("reads a whole number from 40 to 99, and nothing else", () => {
    expect(parseEmbedWidth("40")).toBe(40);
    expect(parseEmbedWidth("99")).toBe(99);
    for (const value of [undefined, null, "", "100", "39", "60%", "060", "6O", " 60", "60 "]) {
      expect(parseEmbedWidth(value), String(value)).toBeNull();
    }
  });
});

describe("sanitizeArticleHtml: uploaded images kept as media keys (plan 017, D-277)", () => {
  const KEY = "news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg";

  it("keeps a valid key and the alt, in that order, with no src", () => {
    expect(sanitizeArticleHtml(`<p>a</p><img data-media-key="${KEY}" alt="รูปเกม"><p>b</p>`).html).toBe(
      `<p>a</p><img data-media-key="${KEY}" alt="รูปเกม" /><p>b</p>`,
    );
    expect(sanitizeArticleHtml(`<img alt="" data-media-key="${KEY}">`).html).toBe(`<img data-media-key="${KEY}" alt="" />`);
    expect(sanitizeArticleHtml(`<img data-media-key="${KEY}">`).html).toBe(`<img data-media-key="${KEY}" />`);
  });

  it("drops any src beside a valid key, a javascript: one included", () => {
    for (const src of ["https://media.example.com/x.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA"]) {
      expect(sanitizeArticleHtml(`<img src="${src}" data-media-key="${KEY}" alt="a">`).html).toBe(
        `<img data-media-key="${KEY}" alt="a" />`,
      );
    }
  });

  it("ends the key at its closing quote, so a quote cannot add an attribute", () => {
    expect(sanitizeArticleHtml(`<img data-media-key="${KEY}" onerror="alert(1)" alt="a">`).html).toBe(
      `<img data-media-key="${KEY}" alt="a" />`,
    );
  });

  it("strips onerror and every other attribute from a keyed image", () => {
    const html = sanitizeArticleHtml(
      `<img data-media-key="${KEY}" alt="a" onerror="alert(1)" class="x" style="color:red" data-x="1" width="10" srcset="a.jpg 1x">`,
    ).html;
    expect(html).toBe(`<img data-media-key="${KEY}" alt="a" />`);
  });

  it.each([
    ["a parent path", "../secret.txt"],
    ["a parent path under news/", "news/../secret.txt"],
    ["a query", `${KEY}?x=1`],
    ["another prefix", "private/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg"],
    ["an upper-case uuid", "news/2026/11/0F8FAD5B-D9CB-469F-A165-70867728950E.jpg"],
    ["an escaped quote inside it", `${KEY}&quot; onerror=&quot;alert(1)`],
    ["spaces around it", ` ${KEY} `],
  ])("drops a key with %s, and the image with it when it has no valid src", (_, key) => {
    expect(sanitizeArticleHtml(`<p>a</p><img data-media-key="${key}" alt="a"><p>b</p>`).html).toBe("<p>a</p><p>b</p>");
  });

  it("keeps an imported image's absolute src when a bad key sits beside it", () => {
    expect(sanitizeArticleHtml('<img src="https://old.test/a.jpg" data-media-key="../x" alt="a">').html).toBe(
      '<img src="https://old.test/a.jpg" alt="a" />',
    );
  });

  it("keeps a keyed image inside a figure and a link", () => {
    expect(
      sanitizeArticleHtml(`<figure><a href="https://ok.test/"><img data-media-key="${KEY}" alt="a"></a><figcaption>c</figcaption></figure>`).html,
    ).toBe(`<figure><a href="https://ok.test/" rel="noopener"><img data-media-key="${KEY}" alt="a" /></a><figcaption>c</figcaption></figure>`);
  });

  it("leaves the imported fixture posts as they were: no data-media-key", () => {
    for (const post of posts as { id: number; content: { rendered: string } }[]) {
      expect(sanitizeArticleHtml(post.content.rendered).html, String(post.id)).not.toContain("data-media-key");
    }
  });

  it("is stable: a sanitised keyed body sanitises to itself", () => {
    const once = sanitizeArticleHtml(`<p>x</p><img data-media-key="${KEY}" alt="a &amp; &quot;b&quot;">`).html;
    expect(sanitizeArticleHtml(once).html).toBe(once);
  });
});

describe("sanitizeArticleHtml: the embed width of an uploaded image (D-283)", () => {
  const KEY = "news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg";

  it("keeps a valid data-width on an image with a valid media key, after its key and alt", () => {
    expect(sanitizeArticleHtml(`<p><img data-width="60" alt="a" data-media-key="${KEY}"></p>`).html).toBe(
      `<p><img data-media-key="${KEY}" alt="a" data-width="60" /></p>`,
    );
    expect(sanitizeArticleHtml(`<p><img data-media-key="${KEY}" data-width="40"></p>`).html).toBe(
      `<p><img data-media-key="${KEY}" data-width="40" /></p>`,
    );
  });

  it("drops an invalid data-width on a keyed image", () => {
    for (const width of ["100", "39", "60%", "060", "abc", ""]) {
      expect(sanitizeArticleHtml(`<p><img data-media-key="${KEY}" alt="a" data-width="${width}"></p>`).html, width).toBe(
        `<p><img data-media-key="${KEY}" alt="a" /></p>`,
      );
    }
  });

  it("drops data-width on an imported image (absolute src, no key) and on one whose key does not match", () => {
    expect(sanitizeArticleHtml('<p><img src="https://x.test/a.png" alt="a" data-width="60"></p>').html).toBe(
      '<p><img src="https://x.test/a.png" alt="a" /></p>',
    );
    expect(sanitizeArticleHtml('<p><img src="https://x.test/a.png" data-media-key="news/x.jpg" data-width="60"></p>').html).toBe(
      '<p><img src="https://x.test/a.png" /></p>',
    );
  });
});
