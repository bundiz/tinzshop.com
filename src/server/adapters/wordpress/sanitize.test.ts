import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, decodeSlug, htmlToPlainText, sanitizeArticleHtml } from "./sanitize";

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
});
