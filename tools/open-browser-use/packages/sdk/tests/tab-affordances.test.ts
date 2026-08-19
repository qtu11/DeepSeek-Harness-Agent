import { describe, expect, it } from "vitest";
import { Guards } from "../src/guards.js";
import { Tab } from "../src/tab.js";
import * as M from "../src/wire/methods.js";

class FakeTransport {
  calls: Array<{ method: string; params: Record<string, unknown>; timeout?: number }> = [];

  async sendRequest<T>(method: string, params: Record<string, unknown>, timeout?: number): Promise<T> {
    this.calls.push({ method, params, timeout });
    if (method === M.TAB_SNAPSHOT_TEXT) {
      return {
        result: {
          value: {
            url: "https://example.test",
            title: "Example",
            headings: [],
            buttons: [],
            links: [],
            forms: [],
            interactables: [{ role: "button", name: "Save", tag: "button", type: "", id: "", enabled: true, visible: true }],
            meta: {
              truncated: false,
              categories: {
                headings: { shown: 0, total: 0, truncated: false },
                buttons: { shown: 0, total: 0, truncated: false },
                links: { shown: 0, total: 0, truncated: false },
                forms: { shown: 0, total: 0, truncated: false },
                interactables: { shown: 1, total: 1, truncated: false },
              },
            },
          },
        },
      } as T;
    }
    throw new Error(`unexpected method ${method}`);
  }
}

describe("Tab.affordances", () => {
  it("returns the snapshot interactables as the affordance surface", async () => {
    const transport = new FakeTransport();
    const tab = new Tab(transport as any, new Guards(), "tab-1");

    const result = await tab.affordances({ maxItems: 5 });

    expect(result.interactables).toHaveLength(1);
    expect(result.interactables[0]?.name).toBe("Save");
    expect(transport.calls[0]).toMatchObject({ method: M.TAB_SNAPSHOT_TEXT });
  });
});
