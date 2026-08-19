// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { snapshotTextExpression } from "../src/snapshot-text.js";

// The builder is a self-contained `(() => {...})()` source string that ships to the
// page verbatim. We exercise the EXACT shipped source here by evaluating it against a
// happy-dom document. `(0, eval)` keeps it an indirect eval (no local-scope capture).
function run(maxItems = 20, maxTextLength = 120): ReturnType<typeof builderResult> {
  // eslint-disable-next-line no-eval
  return (0, eval)(snapshotTextExpression(maxItems, maxTextLength));
}
// type helper only
declare function builderResult(): {
  url: string;
  title: string;
  buttons: string[];
  links: { text: string; href: string }[];
  forms: { label: string; role: string; type: string; name: string; placeholder: string; enabled: boolean; visible: boolean }[];
  interactables: {
    role: string;
    name: string;
    tag: string;
    type: string;
    id: string;
    href?: string;
    enabled: boolean;
    visible: boolean;
    locatorHint?: {
      kind: string;
      expression: string;
      matchCount: number;
      unique: boolean;
      evidence: string;
      ambiguity?: string;
    };
    locatorRecipes?: {
      kind: string;
      expression: string;
      matchCount: number;
      unique: boolean;
      evidence: string;
      ambiguity?: string;
    }[];
  }[];
  focus: {
    tag: string;
    role: string;
    id: string;
    name: string;
    type: string;
    placeholder: string;
    ariaLabel: string;
    enabled: boolean;
    visible: boolean;
  } | null;
  headings: { level: number; text: string }[];
  meta: {
    truncated: boolean;
    categories: Record<string, { shown: number; total: number; truncated: boolean }>;
    hint?: string;
  };
};

describe("snapshotTextExpression", () => {
  it("does not leak nested <style>/<script> text into button labels", () => {
    document.body.innerHTML = `<button><style>.x{color:red}.y:hover{color:#8ab4f8}</style>Search</button>`;
    const r = run();
    expect(r.buttons).toEqual(["Search"]);
  });

  it("drops hidden / aria-hidden inputs from forms (inline attributes)", () => {
    document.body.innerHTML = `
      <input type="hidden" name="csrf" value="z">
      <input type="text" name="q" aria-label="Query">
      <input type="text" name="secret" aria-hidden="true">`;
    const r = run();
    expect(r.forms.map((f) => f.name)).toEqual(["q"]);
  });

  it("drops inputs hidden via a stylesheet display:none rule", () => {
    document.body.innerHTML = `
      <style>.gone{display:none}</style>
      <input type="text" name="visible">
      <input type="text" name="styled" class="gone">`;
    const r = run();
    expect(r.forms.map((f) => f.name)).toEqual(["visible"]);
  });

  it("drops inputs hidden by an ancestor", () => {
    document.body.innerHTML = `
      <style>.gone{display:none}</style>
      <div class="gone"><input type="text" name="secret" aria-label="Secret"></div>
      <input type="text" name="visible" aria-label="Visible">`;

    const r = run();

    expect(r.forms.map((f) => f.name)).toEqual(["visible"]);
    expect(r.interactables.map((item) => item.name)).not.toContain("Secret");
  });

  it("marks zero-layout controls invisible when layout boxes are available", () => {
    document.body.innerHTML = `
      <input id="zero" type="text" name="zero" aria-label="Zero">
      <input id="boxed" type="text" name="boxed" aria-label="Boxed">`;
    const cleanups: Array<() => void> = [];
    const rect = (width: number, height: number) => ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const defineClientRects = (target: Element, value: () => unknown) => {
      const previous = Object.getOwnPropertyDescriptor(target, "getClientRects");
      Object.defineProperty(target, "getClientRects", { configurable: true, value });
      cleanups.push(() => {
        if (previous) Object.defineProperty(target, "getClientRects", previous);
        else delete (target as unknown as Record<string, unknown>).getClientRects;
      });
    };

    defineClientRects(document.documentElement, () => [rect(800, 600)]);
    defineClientRects(document.body, () => [rect(800, 600)]);
    defineClientRects(document.getElementById("zero")!, () => []);
    defineClientRects(document.getElementById("boxed")!, () => [rect(120, 20)]);

    try {
      const r = run();

      expect(r.forms.map((f) => f.name)).toEqual(["boxed"]);
      expect(r.interactables.map((item) => item.name)).toEqual(["Boxed"]);
    } finally {
      cleanups.reverse().forEach((cleanup) => cleanup());
    }
  });

  it("reports per-category totals + truncation when capped", () => {
    document.body.innerHTML = Array.from({ length: 25 }, (_, i) => `<a href="/p${i}">L${i}</a>`).join("");
    const r = run(20, 120);
    expect(r.links.length).toBe(20);
    expect(r.meta.categories.links).toEqual({ shown: 20, total: 25, truncated: true });
    expect(r.meta.truncated).toBe(true);
    expect(r.meta.hint).toContain("tab.evaluate");
    expect(r.meta.hint).toContain("domSnapshot");
  });

  it("marks truncation false and omits hint when nothing is capped/clipped", () => {
    document.body.innerHTML = `<a href="/a">A</a><h1>Title</h1>`;
    const r = run();
    expect(r.meta.truncated).toBe(false);
    expect(r.meta.hint).toBeUndefined();
    expect(r.meta.categories.links).toEqual({ shown: 1, total: 1, truncated: false });
  });

  it("flags truncation when a long string is clipped to maxTextLength", () => {
    document.body.innerHTML = `<a href="/a">${"x".repeat(300)}</a>`;
    const r = run(20, 120);
    expect(r.links[0].text.length).toBe(120);
    expect(r.meta.truncated).toBe(true);
  });

  it("adds role and actionability metadata to forms and focus", () => {
    document.body.innerHTML = `
      <label for="q">Search Wikipedia</label>
      <input id="q" type="search" name="search" placeholder="Search Wikipedia">
      <input type="checkbox" name="wifi" aria-label="Wi-Fi" checked>`;
    document.getElementById("q")?.focus();

    const r = run();

    expect(r.focus).toMatchObject({
      tag: "input",
      role: "searchbox",
      name: "search",
      type: "search",
      enabled: true,
      visible: true,
    });
    expect(r.forms[0]).toMatchObject({
      label: "Search Wikipedia",
      role: "searchbox",
      type: "search",
      name: "search",
      enabled: true,
      visible: true,
    });
    expect(r.forms[1]).toMatchObject({
      label: "Wi-Fi",
      role: "checkbox",
      type: "checkbox",
      name: "wifi",
      enabled: true,
      visible: true,
    });
  });

  it("returns a capped interactables affordance list with role and actionability", () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <a id="compare" href="/compare">Compare models</a>
      <input id="email" type="email" aria-label="Email address" disabled>`;

    const r = run(2, 120);

    expect(r.interactables).toMatchObject([
      {
        role: "button",
        name: "Save",
        tag: "button",
        type: "",
        id: "save",
        enabled: true,
        visible: true,
        locatorHint: {
          kind: "role",
          expression: 'tab.getByRole("button", { name: "Save", exact: true })',
          matchCount: 1,
          unique: true,
        },
      },
      {
        role: "link",
        name: "Compare models",
        tag: "a",
        type: "",
        id: "compare",
        href: "http://localhost:3000/compare",
        enabled: true,
        visible: true,
        locatorHint: {
          kind: "role",
          expression: 'tab.getByRole("link", { name: "Compare models", exact: true })',
          matchCount: 1,
          unique: true,
        },
      },
    ]);
    expect(r.meta.categories.interactables).toEqual({ shown: 2, total: 3, truncated: true });
    expect(r.meta.truncated).toBe(true);
  });

  it("marks locator hints ambiguous when role and name repeat", () => {
    document.body.innerHTML = `
      <button>Save</button>
      <button>Save</button>`;

    const r = run();

    expect(r.interactables[0].locatorHint).toEqual({
      kind: "role",
      expression: 'tab.getByRole("button", { name: "Save", exact: true })',
      matchCount: 2,
      unique: false,
      evidence: "role/name",
      ambiguity: "2 interactables share role/name; scope to a container or use a stronger attribute before acting",
    });
  });

  it("emits exact locator hints so prefix and case variants do not overstate ambiguity", () => {
    document.body.innerHTML = `
      <button>Save</button>
      <button>Save draft</button>
      <button>save</button>`;

    const r = run();

    expect(r.interactables[0].locatorHint).toEqual({
      kind: "role",
      expression: 'tab.getByRole("button", { name: "Save", exact: true })',
      matchCount: 1,
      unique: true,
      evidence: "role/name",
    });
    expect(r.interactables[1].locatorHint).toEqual({
      kind: "role",
      expression: 'tab.getByRole("button", { name: "Save draft", exact: true })',
      matchCount: 1,
      unique: true,
      evidence: "role/name",
    });
    expect(r.interactables[2].locatorHint).toEqual({
      kind: "role",
      expression: 'tab.getByRole("button", { name: "save", exact: true })',
      matchCount: 1,
      unique: true,
      evidence: "role/name",
    });
  });

  it("uses accessible names for locator hints", () => {
    document.body.innerHTML = `
      <button id="icon" aria-label="Close">×</button>
      <span id="submit-label">Submit order</span>
      <button id="labelled" aria-labelledby="submit-label"><span>ignored text</span></button>`;

    const r = run();

    expect(r.interactables[0]).toMatchObject({
      name: "Close",
      locatorHint: {
        kind: "role",
        expression: 'tab.getByRole("button", { name: "Close", exact: true })',
        matchCount: 1,
        unique: true,
      },
    });
    expect(r.interactables[1]).toMatchObject({
      name: "Submit order",
      locatorHint: {
        kind: "role",
        expression: 'tab.getByRole("button", { name: "Submit order", exact: true })',
        matchCount: 1,
        unique: true,
      },
    });
  });

  it("omits exact locator hints when the accessible name is clipped", () => {
    document.body.innerHTML = `<button>${"Confirm ".repeat(30)}</button>`;

    const r = run(20, 40);

    expect(r.interactables[0].name).toHaveLength(40);
    expect(r.interactables[0].locatorHint).toBeUndefined();
    expect(r.meta.truncated).toBe(true);
  });

  it("joins all native labels for locator hint names", () => {
    document.body.innerHTML = `
      <label for="q">First</label>
      <label for="q">Last</label>
      <input id="q" type="text">`;

    const r = run();

    expect(r.interactables[0]).toMatchObject({
      role: "textbox",
      name: "First Last",
      locatorHint: {
        kind: "role",
        expression: 'tab.getByRole("textbox", { name: "First Last", exact: true })',
        matchCount: 1,
        unique: true,
      },
    });
  });

  it("returns locator recipes with uniqueness metadata", () => {
    document.body.innerHTML = `
      <main>
        <button id="save" data-testid="save-button">Save</button>
        <button>Save</button>
        <label for="email">Email</label><input id="email" />
      </main>
    `;

    const r = run();
    const save = r.interactables.find((item) => item.id === "save")!;

    expect(save.locatorRecipes).toEqual([
      {
        kind: "role",
        expression: 'tab.getByRole("button", { name: "Save", exact: true })',
        matchCount: 2,
        unique: false,
        evidence: "role/name",
        ambiguity: "2 interactables share role/name; scope to a container or use a stronger attribute before acting",
      },
      {
        kind: "testid",
        expression: 'tab.getByTestId("save-button")',
        matchCount: 1,
        unique: true,
        evidence: "data-testid",
      },
      {
        kind: "css",
        expression: 'tab.locator("#save")',
        matchCount: 1,
        unique: true,
        evidence: "id",
      },
    ]);
    expect(save.locatorHint).toEqual(save.locatorRecipes?.[1]);
  });
});
