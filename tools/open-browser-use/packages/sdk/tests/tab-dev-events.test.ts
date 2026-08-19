import { describe, expect, it } from "vitest";
import { Guards } from "../src/guards.js";
import { TabDev } from "../src/tab-dev.js";
import * as M from "../src/wire/methods.js";

class FakeTransport {
  calls: Array<{ method: string; params: Record<string, unknown>; timeout?: number }> = [];
  next: unknown = [];

  async sendRequest<T>(method: string, params: Record<string, unknown>, timeout?: number): Promise<T> {
    this.calls.push({ method, params, timeout });
    return this.next as T;
  }
}

describe("TabDev.events", () => {
  it("queries host buffered events for the tab", async () => {
    const transport = new FakeTransport();
    transport.next = [{
      sequence: 1,
      timestamp: 10,
      tab_id: "tab-1",
      session_id: "session-a",
      method: "Runtime.consoleAPICalled",
      params_truncated: false,
      params: { type: "log", args: [] },
    }];
    const dev = new TabDev(transport as any, "tab-1");

    const rows = await dev.events({ methods: ["Runtime.consoleAPICalled"], maxEntries: 5, clear: true });

    expect(rows[0]).toMatchObject({ sequence: 1, tabId: "tab-1", method: "Runtime.consoleAPICalled" });
    expect(transport.calls[0]).toMatchObject({
      method: M.TAB_DEV_EVENTS,
      params: {
        tab_id: "tab-1",
        methods: ["Runtime.consoleAPICalled"],
        maxEntries: 5,
        clear: true,
      },
    });
  });

  it("allows host diagnostics even when the tab handle is not commandable", async () => {
    const transport = new FakeTransport();
    const dev = new TabDev(transport as any, new Guards(), "handoff-tab", () => {
      throw new Error("not commandable");
    });

    await expect(dev.events()).resolves.toEqual([]);
    expect(transport.calls[0]).toMatchObject({
      method: M.TAB_DEV_EVENTS,
      params: { tab_id: "handoff-tab", maxEntries: 100, clear: false },
    });
  });

  it("maps host console events into log entries", async () => {
    const transport = new FakeTransport();
    transport.next = [{
      sequence: 2,
      timestamp: 20,
      tab_id: "tab-1",
      method: "Runtime.consoleAPICalled",
      params_truncated: false,
      params: {
        type: "warning",
        args: [{ value: "careful" }, { unserializableValue: "undefined" }],
      },
    }];
    const dev = new TabDev(transport as any, "tab-1");

    const logs = await dev.logs({ source: "host" });

    expect(logs).toEqual([{ level: "warn", text: "careful undefined", args: ["careful", { type: "undefined" }], timestamp: 20 }]);
  });
});
