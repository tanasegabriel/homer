import { describe, expect, it } from "vitest";
import sanitizeHtml from "@/utils/sanitizeHtml.js";

const parse = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
};

describe("sanitizeHtml", () => {
  it("removes scripts and reports them", () => {
    const { html, removed } = sanitizeHtml(
      "<p>hello</p><script>void 0</script>",
    );

    const fragment = parse(html);
    expect(fragment.querySelector("script")).toBe(null);
    expect(fragment.querySelector("p").textContent).toBe("hello");
    expect(removed).toEqual(["script"]);
  });

  it("removes event handlers but keeps the element", () => {
    const { html, removed } = sanitizeHtml(
      '<img src="logo.png" onerror="void 0">',
    );

    const image = parse(html).querySelector("img");
    expect(image.getAttribute("src")).toBe("logo.png");
    expect(image.hasAttribute("onerror")).toBe(false);
    expect(removed).toEqual(["onerror"]);
  });

  it("removes style and form elements", () => {
    const { html, removed } = sanitizeHtml(
      "<style>p { color: red }</style><form><button>go</button></form>",
    );

    const fragment = parse(html);
    expect(fragment.querySelector("style")).toBe(null);
    expect(fragment.querySelector("form")).toBe(null);
    expect(removed).toEqual(expect.arrayContaining(["style", "form"]));
  });

  it("removes popover and commandfor attributes", () => {
    const { html } = sanitizeHtml(
      '<button popover="auto" commandfor="menu">open</button>',
    );

    const button = parse(html).querySelector("button");
    expect(button.hasAttribute("popover")).toBe(false);
    expect(button.hasAttribute("commandfor")).toBe(false);
  });

  it.each([
    "javascript:void 0",
    "data:text/html,hello",
    "about:blank",
    "ftp://example.com/",
    "blob:https://example.com/id",
  ])("drops an iframe src of %s", (src) => {
    const { html, removed } = sanitizeHtml(`<iframe src="${src}"></iframe>`);

    const iframe = parse(html).querySelector("iframe");
    expect(iframe).not.toBe(null);
    expect(iframe.hasAttribute("src")).toBe(false);
    expect(removed).toContain("src");
  });

  it.each(["https://example.com/embed", "/embed/page"])(
    "keeps an iframe src of %s",
    (src) => {
      const { html, removed } = sanitizeHtml(
        `<iframe src="${src}" allowfullscreen loading="lazy"></iframe>`,
      );

      const iframe = parse(html).querySelector("iframe");
      expect(iframe.getAttribute("src")).toBe(src);
      expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
      expect(iframe.getAttribute("loading")).toBe("lazy");
      expect(removed).toEqual([]);
    },
  );

  it("keeps inline styles, link targets and non-web links", () => {
    const { html, removed } = sanitizeHtml(
      '<a href="ssh://host" target="_blank" style="color: red">host</a>',
    );

    const link = parse(html).querySelector("a");
    expect(link.getAttribute("href")).toBe("ssh://host");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("style")).toBe("color: red");
    expect(removed).toEqual([]);
  });

  it("does not report its own wrapper or comments", () => {
    expect(sanitizeHtml("<b>ok</b>").removed).toEqual([]);
    expect(sanitizeHtml("<!-- <p> --><b>ok</b>").removed).toEqual([]);
  });

  it("reports each removed name once and trims the result", () => {
    const { html, removed } = sanitizeHtml(
      "  <b>ok</b><script>void 0</script><script>void 0</script>  ",
    );

    expect(html).toBe("<b>ok</b>");
    expect(removed).toEqual(["script"]);
  });
});
