import { describe, expect, it } from "vitest";
import { ERR_POSTCONDITION_FAILED } from "../src/errors.js";
import type { Locator } from "../src/locator.js";
import { PostconditionFailedError, TabPostconditions } from "../src/tab-postconditions.js";

class FakeLocator {
  constructor(private readonly values: Record<string, unknown>) {}

  async isVisible() {
    return Boolean(this.values.visible);
  }

  async count() {
    return Number(this.values.count ?? 0);
  }

  async innerText() {
    return String(this.values.text ?? "");
  }
}

describe("TabPostconditions", () => {
  it("throws product-classified errors with condition details", async () => {
    const helper = new TabPostconditions({
      url: async () => "https://example.test/cart",
    });

    await expect(helper.url("https://example.test/done", { timeout: 1, interval: 1 })).rejects.toMatchObject({
      code: ERR_POSTCONDITION_FAILED,
      data: {
        code: "postcondition_failed",
        condition: "url",
        expected: "https://example.test/done",
        actual: "https://example.test/cart",
      },
    });
  });

  it("passes visible text and count helpers when conditions are met", async () => {
    const helper = new TabPostconditions({ url: async () => "https://example.test" });
    const locator = new FakeLocator({ visible: true, text: "Order complete", count: 1 }) as unknown as Locator;

    await expect(helper.visible(locator)).resolves.toEqual({ ok: true, condition: "visible" });
    await expect(helper.text(locator, /complete/)).resolves.toEqual({ ok: true, condition: "text" });
    await expect(helper.count(locator, 1)).resolves.toEqual({ ok: true, condition: "count" });
  });

  it("polls until an async postcondition becomes true", async () => {
    const helper = new TabPostconditions({ url: async () => "https://example.test" });
    let calls = 0;
    const locator = {
      async isVisible() {
        calls += 1;
        return calls >= 3;
      },
    } as unknown as Locator;

    await expect(helper.visible(locator, { timeout: 200, interval: 1 })).resolves.toEqual({
      ok: true,
      condition: "visible",
    });
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("wraps custom predicate failures", async () => {
    const helper = new TabPostconditions({ url: async () => "https://example.test" });

    await expect(
      helper.custom("toast", async () => ({ ok: false, actual: "missing", expected: "Saved" }), {
        timeout: 1,
        interval: 1,
      }),
    ).rejects.toBeInstanceOf(PostconditionFailedError);
  });

  it("treats plain false custom predicate results as product-classified failures", async () => {
    const helper = new TabPostconditions({ url: async () => "https://example.test" });

    await expect(helper.custom("toast", async () => false, { timeout: 1, interval: 1 })).rejects.toMatchObject({
      code: ERR_POSTCONDITION_FAILED,
      data: {
        code: "postcondition_failed",
        condition: "toast",
        expected: true,
        actual: false,
      },
    });
  });
});
