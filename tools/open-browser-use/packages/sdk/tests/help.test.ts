import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Agent } from "../src/agent.js";
import { renderHelp } from "../src/help.js";

describe("help", () => {
  it("documents the P2 agent, browser, tab, and locator surfaces", () => {
    const help = renderHelp();
    expect(help).toContain("agent.browsers.get");
    expect(help).toContain("get(\"chrome\") is WebExtension-backed Chrome by default");
    expect(help).toContain("fails fast instead of falling back to CDP");
    expect(help).toContain("use get(\"cdp\") or an explicit CDP backend option");
    expect(help).toContain("agent.browsers.diagnostics");
    expect(help).toContain(".lifecycleDiagnostics");
    expect(help).toContain(".capabilityRegistry.list()/has(name)/get(name)");
    expect(help).toContain(".profileMetadata");
    expect(help).toContain(".deliverables()");
    expect(help).toContain(".clearLifecycleDiagnostics()");
    expect(help).toContain(".tabs.create");
    expect(help).toContain(".tabs.content({urls})");
    expect(help).toContain(".viewport?.set({width,height})");
    expect(help).toContain(".visibility?.set({visible})");
    expect(help).toContain(".waitForEvent(\"filechooser\"|\"download\")");
    expect(help).toContain(".waitForNavigation()");
    expect(help).toContain(".domSnapshot()");
    expect(help).toContain("display(await tab.screenshot())");
    expect(help).toContain(".dom_cua.text()");
    expect(help).toContain(".cua.click");
    expect(help).toContain(".dev.cdp");
    expect(help).toContain(".dev.events");
    expect(help).toContain(".affordances");
    expect(help).toContain(".postconditions.url()");
    expect(help).toContain(".getByRole");
    expect(help).toContain(".all() -> Locator[] with batched collection reads");
    expect(help).toContain("only after count() or scoped evidence");
    expect(help).toContain("display(value)");
  });

  it("does not steer agents toward about:blank bootstrap tabs", () => {
    const help = renderHelp();

    expect(help).toContain("create the first task tab with the target URL");
    expect(help).toContain("avoid an intermediate about:blank tab");
    expect(help).not.toContain("defaults to \"about:blank\"");
  });

  it("is returned by Agent.help", () => {
    const agent = new Agent({
      listBackends: () => [],
      connectBackend: async () => {
        throw new Error("unexpected connect");
      },
    });

    expect(agent.help()).toBe(renderHelp());
  });

  it("keeps overview docs on the safe user-tab discovery surface", async () => {
    const sdkReadme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const normalizedReadme = sdkReadme.replace(/\s+/g, " ");

    expect(sdkReadme).toContain("browser.tabs.current()");
    expect(sdkReadme).toContain("browser.tabs.selected()");
    expect(sdkReadme).toContain("browser.user.discoverTabs()");
    expect(normalizedReadme).toContain("create the first task tab with the target URL");
    expect(normalizedReadme).toContain("avoid an intermediate `about:blank` tab");
    expect(sdkReadme).not.toContain("browser.user.openTabs/history/claimTab");
    expect(sdkReadme).not.toContain("browser.user.openTabs()` |");

    // docs/current-product-architecture.md is gitignored (developer-local), so it
    // is absent on clean checkouts/CI. Validate it only when present.
    const architecture = await readFile(
      new URL("../../../docs/current-product-architecture.md", import.meta.url),
      "utf8",
    ).catch(() => undefined);
    if (architecture === undefined) return;
    expect(architecture).toContain("tabs.create/list/get/current/selected");
    expect(architecture).toContain("user.discoverTabs/history/claimTab");
    expect(architecture).not.toContain("user.openTabs/history/claimTab");
    expect(architecture).not.toContain("| `BrowserUser` | `openTabs()`");
  });
});
