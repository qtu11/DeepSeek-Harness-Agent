import { ERR_POSTCONDITION_FAILED, ObuError, productErrorData } from "./errors.js";
import type { Locator } from "./locator.js";

export type PostconditionPass = { ok: true; condition: string };
export type CustomPostconditionResult =
  | boolean
  | { ok: true }
  | { ok: false; expected?: unknown; actual?: unknown; message?: string };
export type PostconditionOptions = { timeout?: number; interval?: number };

type PostconditionCheck = { ok: true } | { ok: false; expected?: unknown; actual?: unknown; message?: string };

const DEFAULT_POSTCONDITION_TIMEOUT_MS = 5_000;
const DEFAULT_POSTCONDITION_INTERVAL_MS = 100;

export class PostconditionFailedError extends ObuError {
  constructor(condition: string, details: Record<string, unknown>) {
    super(
      ERR_POSTCONDITION_FAILED,
      `postcondition failed: ${condition}`,
      productErrorData("postcondition_failed", { condition, ...details }),
    );
  }
}

export class TabPostconditions {
  constructor(private readonly tab: { url(): Promise<string> }) {}

  async url(expected: string | RegExp, opts: PostconditionOptions = {}): Promise<PostconditionPass> {
    return await this.expectEventually("url", opts, async () => {
      const actual = await this.tab.url();
      const ok = typeof expected === "string" ? actual === expected : expected.test(actual);
      return ok ? { ok: true } : { ok: false, expected: String(expected), actual };
    });
  }

  async visible(locator: Locator, opts: PostconditionOptions = {}): Promise<PostconditionPass> {
    return await this.expectEventually("visible", opts, async () => {
      const actual = await locator.isVisible();
      return actual ? { ok: true } : { ok: false, expected: true, actual };
    });
  }

  async hidden(locator: Locator, opts: PostconditionOptions = {}): Promise<PostconditionPass> {
    return await this.expectEventually("hidden", opts, async () => {
      const actual = await locator.isVisible();
      return !actual ? { ok: true } : { ok: false, expected: false, actual };
    });
  }

  async text(locator: Locator, expected: string | RegExp, opts: PostconditionOptions = {}): Promise<PostconditionPass> {
    return await this.expectEventually("text", opts, async () => {
      const actual = await locator.innerText();
      const ok = typeof expected === "string" ? actual.includes(expected) : expected.test(actual);
      return ok ? { ok: true } : { ok: false, expected: String(expected), actual };
    });
  }

  async count(locator: Locator, expected: number, opts: PostconditionOptions = {}): Promise<PostconditionPass> {
    return await this.expectEventually("count", opts, async () => {
      const actual = await locator.count();
      return actual === expected ? { ok: true } : { ok: false, expected, actual };
    });
  }

  async custom(
    condition: string,
    predicate: () => Promise<CustomPostconditionResult> | CustomPostconditionResult,
    opts: PostconditionOptions = {},
  ): Promise<PostconditionPass> {
    return await this.expectEventually(condition, opts, async () => {
      const result = await predicate();
      return normalizeCustomResult(result) ?? {
        ok: false,
        expected: "a boolean or { ok } postcondition result",
        actual: result,
        message: "custom predicate returned an invalid result",
      };
    });
  }

  private async expectEventually(
    condition: string,
    opts: PostconditionOptions,
    check: () => Promise<PostconditionCheck>,
  ): Promise<PostconditionPass> {
    const timeout = positiveMs(opts.timeout, DEFAULT_POSTCONDITION_TIMEOUT_MS);
    const interval = positiveMs(opts.interval, DEFAULT_POSTCONDITION_INTERVAL_MS);
    const deadline = Date.now() + timeout;
    let last: PostconditionCheck = { ok: false, expected: true };
    do {
      last = await check();
      if (last.ok) return { ok: true, condition };
      if (Date.now() >= deadline) break;
      await delay(Math.min(interval, Math.max(0, deadline - Date.now())));
    } while (Date.now() <= deadline);
    const failure: { expected?: unknown; actual?: unknown; message?: string } = last.ok ? { expected: true } : last;
    const details: Record<string, unknown> = { timeout };
    if ("expected" in failure) details.expected = failure.expected;
    if ("actual" in failure) details.actual = failure.actual;
    if (failure.message) details.message = failure.message;
    throw new PostconditionFailedError(condition, details);
  }
}

function positiveMs(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCustomResult(value: unknown): PostconditionCheck | undefined {
  if (value === true) return { ok: true };
  if (value === false) return { ok: false, expected: true, actual: false };
  if (value === null || typeof value !== "object") return undefined;
  const record = value as { ok?: unknown; expected?: unknown; actual?: unknown; message?: unknown };
  if (record.ok === true) return { ok: true };
  if (record.ok === false) {
    return {
      ok: false,
      expected: record.expected,
      actual: record.actual,
      ...(typeof record.message === "string" ? { message: record.message } : {}),
    };
  }
  return undefined;
}
