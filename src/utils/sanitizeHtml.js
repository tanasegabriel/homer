import DOMPurify from "dompurify";

const OPTIONS = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "target",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "sandbox",
    "loading",
    "referrerpolicy",
  ],
  FORBID_TAGS: ["style", "form"],
  FORBID_ATTR: ["popover", "commandfor"],
  ALLOW_UNKNOWN_PROTOCOLS: true,
  FORCE_BODY: true,
};

const isWebUrl = (value) => {
  try {
    return ["http:", "https:"].includes(
      new URL(value, document.baseURI).protocol,
    );
  } catch {
    return false;
  }
};

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (
    node.nodeName === "IFRAME" &&
    data.attrName === "src" &&
    !isWebUrl(data.attrValue)
  ) {
    data.keepAttr = false;
  }
});

export default function sanitizeHtml(dirty) {
  const html = DOMPurify.sanitize(dirty, OPTIONS).trim();
  const removed = DOMPurify.removed
    .map(
      ({ element, attribute }) =>
        element?.nodeName.toLowerCase() ?? attribute?.name,
    )
    .filter((name) => !["remove", "#comment"].includes(name));
  return { html, removed: [...new Set(removed)] };
}
