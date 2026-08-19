// Page-text snapshot builder.
//
// This is the single in-page extractor that feeds BOTH `tab.snapshotText()` and
// `tab.observe().text`. It runs in the page (serialized to a source string and
// evaluated via the backend), so it may reference only `document`/`window`/`location`
// and its own inner declarations — never module scope.
//
// Design notes (why this is what it is):
//   * It is an AFFORDANCE SUMMARY, not page content. It deliberately carries no prose:
//     adding a "body" field would re-centralize env-decided digestion (which prose? what
//     truncation?), which is the finite-space projection the project explicitly rejects.
//     The agent reads content at full fidelity and agent-scoped via its open action space
//     (`tab.evaluate(...)`) or `tab.domSnapshot()`. `meta.hint` says so when truncated.
//   * Compaction is HONEST: every category reports {shown,total,truncated} computed BEFORE
//     slicing, and `meta.truncated` is set when any category is capped OR any value is
//     clipped to `maxTextLength`. No silent caps.
//   * It never leaks `<style>`/`<script>` text into labels, and it drops hidden /
//     non-actionable inputs.
//
// The string is a hand-written literal (no `Function.prototype.toString`) so the shipped
// source is identical in dev and bundled builds — zero bundler-transform risk.

/** Per-category compaction report so the agent owns the scope decision. */
export type SnapshotCategoryMeta = {
  /** Items included in the (capped) array. */
  shown: number;
  /** Total matching elements on the page before the cap. */
  total: number;
  /** True iff `shown < total`. */
  truncated: boolean;
};

/** Self-describing compaction metadata attached to a page-text snapshot. */
export type SnapshotTextMeta = {
  /** True iff any category was capped OR any text value was clipped to `maxTextLength`. */
  truncated: boolean;
  categories: {
    headings: SnapshotCategoryMeta;
    buttons: SnapshotCategoryMeta;
    links: SnapshotCategoryMeta;
    forms: SnapshotCategoryMeta;
    interactables: SnapshotCategoryMeta;
  };
  /** Present iff `truncated`: tells the agent how to read the full / scoped page. */
  hint?: string;
};

export function snapshotTextExpression(maxItems: number, maxTextLength: number): string {
  return `
(() => {
  const OBU_OVERLAY_SELECTOR = "#obu-agent-overlay-root,[data-obu-overlay-root]";
  let __clipped = false;
  const normalizeText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const text = (value) => {
    const s = normalizeText(value);
    if (s.length > ${maxTextLength}) { __clipped = true; return s.slice(0, ${maxTextLength}); }
    return s;
  };
  const isObuOverlay = (el) => Boolean(el?.matches?.(OBU_OVERLAY_SELECTOR) || el?.closest?.(OBU_OVERLAY_SELECTOR));
  // Never leak <style>/<script> text content into a label. textContent concatenates the
  // text of nested <style> nodes (e.g. Google injects scoped styles inside buttons), so
  // strip them on a clone before reading.
  const cleanTextRaw = (el) => {
    if (!el) return "";
    if (el.querySelector && el.querySelector("style,script")) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll("style,script").forEach((n) => n.remove());
      return normalizeText(clone.textContent);
    }
    return normalizeText(el.textContent);
  };
  const cleanText = (el) => text(cleanTextRaw(el));
  const all = (selector) => Array.from(document.querySelectorAll(selector)).filter((el) => !isObuOverlay(el));
  const cap = (arr) => arr.slice(0, ${maxItems});
  const rectHasArea = (rect) => rect && rect.width > 0 && rect.height > 0;
  const layoutHasBoxes = (() => {
    try {
      const root = document.documentElement;
      const body = document.body;
      return Boolean(
        (root && typeof root.getClientRects === "function" && Array.from(root.getClientRects()).some(rectHasArea)) ||
        (body && typeof body.getClientRects === "function" && Array.from(body.getClientRects()).some(rectHasArea))
      );
    } catch {
      return false;
    }
  })();
  const isVisible = (el) => {
    if (!el) return false;
    for (let current = el; current && current.nodeType === 1; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
      const view = current.ownerDocument && current.ownerDocument.defaultView;
      if (view && typeof view.getComputedStyle === "function") {
        const style = view.getComputedStyle(current);
        if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      }
    }
    if (!layoutHasBoxes || typeof el.getClientRects !== "function") return true;
    return Array.from(el.getClientRects()).some(rectHasArea);
  };
  const isActionableInput = (el) => {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "hidden") return false;
    return isVisible(el);
  };
  const isEnabled = (el) => {
    if (!el) return false;
    if (el.disabled === true || el.getAttribute("disabled") !== null) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    return true;
  };
  const labelFor = (input) => {
    if (input.labels && input.labels.length) return text(input.labels[0].textContent);
    if (input.getAttribute("aria-label")) return text(input.getAttribute("aria-label"));
    return text(input.getAttribute("name") || input.getAttribute("placeholder") || "");
  };
  const roleOf = (el) => {
    const explicit = text(el.getAttribute("role")).split(" ").filter(Boolean)[0];
    if (explicit) return explicit;
    const tag = (el.tagName || "").toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (tag === "a" && el.getAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "summary") return "button";
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (["button", "submit", "reset", "image"].includes(type)) return "button";
      if (type === "range") return "slider";
      if (type === "number") return "spinbutton";
      if (type === "search") return el.getAttribute("aria-autocomplete") || el.getAttribute("list") ? "combobox" : "searchbox";
      if (["email", "password", "tel", "text", "url", ""].includes(type)) return "textbox";
    }
    return "";
  };
  const labelledByText = (el) => {
    const ids = normalizeText(el.getAttribute("aria-labelledby")).split(" ").filter(Boolean);
    if (!ids.length) return "";
    const root = el.ownerDocument || document;
    return normalizeText(ids.map((id) => cleanTextRaw(root.getElementById(id))).filter(Boolean).join(" "));
  };
  const nativeLabelText = (el) => el.labels && el.labels.length
    ? normalizeText(Array.from(el.labels).map((label) => cleanTextRaw(label)).filter(Boolean).join(" "))
    : "";
  const inputButtonValue = (el) => {
    const tag = (el.tagName || "").toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    return tag === "input" && ["button", "submit", "reset", "image"].includes(type)
      ? normalizeText(el.getAttribute("value"))
      : "";
  };
  const locatorNameFor = (el) =>
    labelledByText(el) ||
    normalizeText(el.getAttribute("aria-label")) ||
    nativeLabelText(el) ||
    normalizeText(el.getAttribute("alt")) ||
    inputButtonValue(el) ||
    cleanTextRaw(el) ||
    normalizeText(el.getAttribute("title"));
  const interactableName = (el) =>
    text(locatorNameFor(el)) ||
    text(el.getAttribute("title")) ||
    text(el.getAttribute("placeholder")) ||
    text(el.getAttribute("value")) ||
    text(el.getAttribute("name"));
  const active = document.activeElement && !isObuOverlay(document.activeElement)
    ? {
        tag: text(document.activeElement.tagName.toLowerCase()),
        role: roleOf(document.activeElement),
        id: text(document.activeElement.id),
        name: text(document.activeElement.getAttribute("name")),
        type: text(document.activeElement.getAttribute("type")),
        placeholder: text(document.activeElement.getAttribute("placeholder")),
        ariaLabel: text(document.activeElement.getAttribute("aria-label")),
        enabled: isEnabled(document.activeElement),
        visible: isVisible(document.activeElement),
      }
    : null;

  const headingEls = all("h1,h2,h3");
  const buttonEls = all("button,[role=button],input[type=button],input[type=submit]").filter(isVisible);
  const linkEls = all("a[href]").filter(isVisible);
  const formEls = all("input,textarea,select").filter(isActionableInput);
  const interactableEls = all([
    "button",
    "a[href]",
    "input",
    "textarea",
    "select",
    "summary",
    "[role=button]",
    "[role=link]",
    "[role=menuitem]",
    "[role=tab]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=combobox]",
    "[role=searchbox]",
    "[role=textbox]",
    "[tabindex]",
  ].join(",")).filter((el) => {
    const tag = (el.tagName || "").toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (tag === "input" && type === "hidden") return false;
    if (isObuOverlay(el)) return false;
    if (!isVisible(el)) return false;
    return Boolean(roleOf(el) || interactableName(el));
  });
  const quote = (value) => JSON.stringify(String(value || ""));
  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\\\#.;:[\\]()>+~*^$|=,\\s]/g, "\\\\$&");
  };
  const countSelector = (selector) => {
    try { return document.querySelectorAll(selector).length; } catch { return 0; }
  };
  const recipe = (kind, expression, matchCount, evidence, ambiguity) => ({
    kind,
    expression,
    matchCount,
    unique: matchCount === 1,
    evidence,
    ...(ambiguity ? { ambiguity } : {}),
  });
  const roleNameKey = (role, name) => role && name ? role + "::obu::" + name : "";
  const roleNameCounts = new Map();
  for (const el of interactableEls) {
    const role = roleOf(el);
    const name = locatorNameFor(el);
    if (name.length > ${maxTextLength}) continue;
    const key = roleNameKey(role, name);
    if (!key) continue;
    roleNameCounts.set(key, (roleNameCounts.get(key) || 0) + 1);
  }
  const locatorRecipesFor = (el) => {
    const recipes = [];
    const role = roleOf(el);
    const name = locatorNameFor(el);
    if (name.length <= ${maxTextLength}) {
      const key = roleNameKey(role, name);
      const matchCount = key ? (roleNameCounts.get(key) || 0) : 0;
      if (key) {
        recipes.push(recipe(
          "role",
          "tab.getByRole(" + quote(role) + ", { name: " + quote(name) + ", exact: true })",
          matchCount,
          "role/name",
          matchCount > 1 ? matchCount + " interactables share role/name; scope to a container or use a stronger attribute before acting" : undefined
        ));
      }
    }
    const testId = normalizeText(el.getAttribute("data-testid"));
    if (testId) {
      const selector = "[data-testid=" + quote(testId) + "]";
      recipes.push(recipe("testid", "tab.getByTestId(" + quote(testId) + ")", countSelector(selector), "data-testid"));
    }
    if (el.id) {
      const selector = "#" + cssEscape(el.id);
      recipes.push(recipe("css", "tab.locator(" + quote(selector) + ")", countSelector(selector), "id"));
    }
    return recipes;
  };
  const preferredLocatorRecipe = (recipes) =>
    recipes.find((row) => row.unique) || recipes[0];

  const headings = cap(headingEls).map((el) => ({ level: Number(el.tagName.slice(1)), text: cleanText(el) }));
  const buttons = cap(buttonEls).map((el) => cleanText(el) || text(el.value) || text(el.getAttribute("aria-label"))).filter(Boolean);
  const links = cap(linkEls).map((el) => ({ text: cleanText(el) || text(el.getAttribute("aria-label")), href: text(el.href) }));
  const forms = cap(formEls).map((el) => ({
    label: labelFor(el),
    role: roleOf(el),
    type: text(el.getAttribute("type") || el.tagName.toLowerCase()),
    name: text(el.getAttribute("name")),
    placeholder: text(el.getAttribute("placeholder")),
    enabled: isEnabled(el),
    visible: isVisible(el),
  }));
  const interactables = cap(interactableEls).map((el) => {
    const locatorRecipes = locatorRecipesFor(el);
    const locatorHint = preferredLocatorRecipe(locatorRecipes);
    return {
      role: roleOf(el),
      name: interactableName(el),
      tag: text((el.tagName || "").toLowerCase()),
      type: text(el.getAttribute("type")),
      id: text(el.id),
      ...(el.href ? { href: text(el.href) } : {}),
      enabled: isEnabled(el),
      visible: isVisible(el),
      ...(locatorRecipes.length ? { locatorRecipes, locatorHint } : {}),
    };
  });

  const cat = (shown, total) => ({ shown, total, truncated: shown < total });
  const categories = {
    headings: cat(headings.length, headingEls.length),
    buttons: cat(buttons.length, buttonEls.length),
    links: cat(links.length, linkEls.length),
    forms: cat(forms.length, formEls.length),
    interactables: cat(interactables.length, interactableEls.length),
  };
  const truncated = __clipped || categories.headings.truncated || categories.buttons.truncated || categories.links.truncated || categories.forms.truncated || categories.interactables.truncated;
  const meta = {
    truncated,
    categories,
    ...(truncated
      ? { hint: "snapshotText is a capped affordance summary, not page content; for a scoped read run your own tab.evaluate(...) query, or tab.domSnapshot() for the full page" }
      : {}),
  };

  return {
    url: location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    focus: active,
    headings,
    buttons,
    links,
    forms,
    interactables,
    meta,
  };
})()
`;
}
