import { withSessionMeta } from "./session-meta.js";
import { ERR_NOT_IMPLEMENTED, ObuError } from "./errors.js";
import { Guards, type CommandabilityGuard } from "./guards.js";
import type { Transport } from "./wire/transport.js";
import * as M from "./wire/methods.js";

export type TabDevLogLevel = "debug" | "log" | "info" | "warn" | "error";

export type TabDevLogEntry = {
  level: TabDevLogLevel;
  text: string;
  args: unknown[];
  timestamp: number;
};

export type TabDevEvent = {
  sequence: number;
  timestamp: number;
  tabId: string;
  tab_id: string;
  sessionId?: string;
  session_id?: string;
  method: string;
  params: unknown;
  paramsTruncated: boolean;
  params_truncated: boolean;
};

export type TabDevEventsOptions = {
  /** Event methods to include. Empty/omitted means all methods. */
  methods?: string[];
  /** Maximum recent entries to return. Defaults to 100. */
  maxEntries?: number;
  /** Clear matching host-buffered rows after reading. Defaults to false. */
  clear?: boolean;
  timeout?: number;
};

export type TabDevLogsOptions = {
  /** Maximum recent entries to return. Defaults to 100. */
  maxEntries?: number;
  /** Clear the page buffer after reading. Defaults to false. */
  clear?: boolean;
  /** Read from host event buffer, page wrapper, or host then page fallback. Defaults to "auto". */
  source?: "auto" | "host" | "page";
  timeout?: number;
};

type RuntimeEvaluateResponse = {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
};

export class TabDev {
  private readonly guards: Guards;
  private readonly tabId: string;

  constructor(
    private readonly transport: Transport,
    guardsOrTabId: Guards | string,
    tabId?: string,
    private readonly ensureCommandable?: CommandabilityGuard,
  ) {
    this.guards = guardsOrTabId instanceof Guards ? guardsOrTabId : new Guards();
    this.tabId = guardsOrTabId instanceof Guards ? (tabId ?? "") : guardsOrTabId;
  }

  async cdp<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    opts: { timeout?: number } = {},
  ): Promise<T> {
    this.ensureCommandable?.(M.EXECUTE_CDP);
    const command = {
      command: M.EXECUTE_CDP,
      tab_id: this.tabId,
      target: { tabId: this.tabId },
      method,
      commandParams: params,
    };
    const currentUrl = this.guards.needsCurrentUrl(M.EXECUTE_CDP)
      ? await this.transport.sendRequest<string>(M.TAB_URL, withSessionMeta({ tab_id: this.tabId }), opts.timeout)
      : undefined;
    await this.guards.ensureCommandAllowed(command, { currentUrl });
    return await this.transport.sendRequest<T>(
      M.EXECUTE_CDP,
      withSessionMeta({
        tab_id: this.tabId,
        target: { tabId: this.tabId },
        method,
        commandParams: params,
      }),
      opts.timeout,
    );
  }

  async logs(opts: TabDevLogsOptions = {}): Promise<TabDevLogEntry[]> {
    const source = opts.source ?? "auto";
    if (source === "host" || source === "auto") {
      try {
        const eventOpts: TabDevEventsOptions = {
          methods: ["Runtime.consoleAPICalled", "Log.entryAdded"],
        };
        if (opts.maxEntries !== undefined) eventOpts.maxEntries = opts.maxEntries;
        if (opts.clear !== undefined) eventOpts.clear = opts.clear;
        if (opts.timeout !== undefined) eventOpts.timeout = opts.timeout;
        const rows = await this.events(eventOpts);
        return normalizeHostLogEvents(rows);
      } catch (error) {
        if (source === "host" || !isHostDevEventsUnavailable(error)) throw error;
      }
    }
    return await this.pageConsoleLogs(opts);
  }

  async events(opts: TabDevEventsOptions = {}): Promise<TabDevEvent[]> {
    const maxEntries = positiveInt(opts.maxEntries, 100);
    const params: Record<string, unknown> = {
      tab_id: this.tabId,
      maxEntries,
      clear: opts.clear === true,
    };
    if (opts.methods !== undefined) params.methods = opts.methods;
    const rows = await this.transport.sendRequest<unknown[]>(
      M.TAB_DEV_EVENTS,
      withSessionMeta(params),
      opts.timeout,
    );
    return normalizeDevEvents(rows);
  }

  private async pageConsoleLogs(opts: TabDevLogsOptions): Promise<TabDevLogEntry[]> {
    const maxEntries = positiveInt(opts.maxEntries, 100);
    const clearAfterRead = opts.clear === true;
    const cdpOpts: { timeout?: number } = {};
    if (opts.timeout !== undefined) cdpOpts.timeout = opts.timeout;
    const response = await this.cdp<RuntimeEvaluateResponse>(
      "Runtime.evaluate",
      {
        expression: consoleLogBufferExpression(maxEntries, clearAfterRead),
        awaitPromise: true,
        returnByValue: true,
      },
      cdpOpts,
    );
    if (response?.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description
          ?? response.exceptionDetails.text
          ?? "tab.dev.logs failed",
      );
    }
    return normalizeLogEntries(response?.result?.value);
  }
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? Math.floor(value)
    : fallback;
}

function normalizeLogEntries(value: unknown): TabDevLogEntry[] {
  if (!Array.isArray(value)) return [];
  const rows: TabDevLogEntry[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (!isLogLevel(record.level) || typeof record.text !== "string") continue;
    rows.push({
      level: record.level,
      text: record.text,
      args: Array.isArray(record.args) ? record.args : [],
      timestamp: typeof record.timestamp === "number" ? record.timestamp : 0,
    });
  }
  return rows;
}

function normalizeDevEvents(value: unknown): TabDevEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const method = typeof record.method === "string" ? record.method : undefined;
    const tabId = typeof record.tab_id === "string"
      ? record.tab_id
      : typeof record.tabId === "string"
        ? record.tabId
        : undefined;
    if (!method || !tabId) return [];
    const paramsTruncated = record.params_truncated === true || record.paramsTruncated === true;
    const out: TabDevEvent = {
      sequence: typeof record.sequence === "number" ? record.sequence : 0,
      timestamp: typeof record.timestamp === "number" ? record.timestamp : 0,
      tabId,
      tab_id: tabId,
      method,
      params: record.params,
      paramsTruncated,
      params_truncated: paramsTruncated,
    };
    const sessionId = typeof record.session_id === "string"
      ? record.session_id
      : typeof record.sessionId === "string"
        ? record.sessionId
        : undefined;
    if (sessionId) {
      out.sessionId = sessionId;
      out.session_id = sessionId;
    }
    return [out];
  });
}

function normalizeHostLogEvents(events: TabDevEvent[]): TabDevLogEntry[] {
  return events.flatMap((event) => {
    if (event.method === "Runtime.consoleAPICalled") return [consoleApiCalledToLogEntry(event)];
    if (event.method === "Log.entryAdded") return [logEntryAddedToLogEntry(event)];
    return [];
  });
}

function consoleApiCalledToLogEntry(event: TabDevEvent): TabDevLogEntry {
  const params = asRecord(event.params);
  const type = typeof params?.type === "string" ? params.type : "log";
  const args = Array.isArray(params?.args) ? params.args.map(remoteObjectToValue) : [];
  return {
    level: consoleTypeToLogLevel(type),
    text: truncateText(args.map(logText).join(" "), 2000),
    args,
    timestamp: event.timestamp,
  };
}

function logEntryAddedToLogEntry(event: TabDevEvent): TabDevLogEntry {
  const params = asRecord(event.params);
  const entry = asRecord(params?.entry);
  const level = typeof entry?.level === "string" ? entry.level : "log";
  const text = typeof entry?.text === "string" ? entry.text : "";
  return {
    level: consoleTypeToLogLevel(level),
    text: truncateText(text, 2000),
    args: [],
    timestamp: typeof entry?.timestamp === "number" ? entry.timestamp : event.timestamp,
  };
}

function remoteObjectToValue(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return value;
  if ("value" in record) return record.value;
  if (typeof record.unserializableValue === "string") {
    return { type: record.unserializableValue };
  }
  if (typeof record.description === "string") return truncateText(record.description, 1000);
  if (typeof record.type === "string") {
    return {
      type: record.type,
      ...(typeof record.subtype === "string" ? { subtype: record.subtype } : {}),
    };
  }
  return value;
}

function consoleTypeToLogLevel(value: string): TabDevLogLevel {
  if (value === "warning") return "warn";
  if (isLogLevel(value)) return value;
  return "log";
}

function logText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (record?.type === "undefined") return "undefined";
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) return truncateText(json, 1000);
  } catch {
    // Fall through to String conversion.
  }
  try {
    return truncateText(String(value), 1000);
  } catch {
    return "[unprintable]";
  }
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...[truncated ${value.length - maxChars} chars]`;
}

function isHostDevEventsUnavailable(error: unknown): boolean {
  if (!(error instanceof ObuError)) return false;
  const data = asRecord(error.data);
  const method = typeof data?.method === "string" ? data.method : undefined;
  const dataCode = typeof data?.code === "string" ? data.code : undefined;
  if (method === M.TAB_DEV_EVENTS && (error.code === ERR_NOT_IMPLEMENTED || dataCode === "unsupported_backend_capability")) {
    return true;
  }
  if (error.code === ERR_NOT_IMPLEMENTED && error.message.includes(M.TAB_DEV_EVENTS)) return true;
  if (error.code === -32601 && error.message.includes(M.TAB_DEV_EVENTS)) return true;
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function isLogLevel(value: unknown): value is TabDevLogLevel {
  return value === "debug" || value === "log" || value === "info" || value === "warn" || value === "error";
}

export function consoleLogBufferExpression(maxEntries: number, clearAfterRead: boolean): string {
  return `
(() => {
  const maxEntries = ${maxEntries};
  const clearAfterRead = ${clearAfterRead};
  const key = "__obuConsoleLogBuffer";
  const levels = ["debug", "log", "info", "warn", "error"];
  const maxTextChars = 2000;
  const maxArgStringChars = 1000;
  const maxArgs = 20;
  const maxKeyChars = 120;
  const maxObjectEntries = 25;
  const maxDepth = 3;
  const truncateString = (value, limit) => {
    const s = String(value);
    if (s.length <= limit) return s;
    return s.slice(0, limit) + "...[truncated " + (s.length - limit) + " chars]";
  };
  const snapshotValue = (value, depth = 0, seen = new WeakSet()) => {
    if (value === undefined) return { type: "undefined" };
    if (value === null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return truncateString(value, maxArgStringChars);
    if (typeof value === "bigint") return truncateString(String(value) + "n", maxArgStringChars);
    if (typeof value === "function") return "[Function " + (value.name || "anonymous") + "]";
    if (value instanceof Error) {
      return {
        name: truncateString(value.name || "Error", 120),
        message: truncateString(value.message || "", maxArgStringChars),
        stack: value.stack ? truncateString(value.stack, maxArgStringChars) : undefined,
      };
    }
    if (typeof value !== "object") return truncateString(String(value), maxArgStringChars);
    if (seen.has(value)) return "[Circular]";
    if (depth >= maxDepth) return Array.isArray(value) ? "[Array]" : "[Object]";
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const out = value.slice(0, maxObjectEntries).map((item) => snapshotValue(item, depth + 1, seen));
        if (value.length > maxObjectEntries) out.push({ __truncatedItems: value.length - maxObjectEntries });
        return out;
      }
      const out = {};
      let copied = 0;
      let truncated = false;
      for (const rawKey in value) {
        if (!Object.prototype.hasOwnProperty.call(value, rawKey)) continue;
        if (copied >= maxObjectEntries) {
          truncated = true;
          break;
        }
        const key = truncateString(rawKey, maxKeyChars);
        try {
          out[key] = snapshotValue(value[rawKey], depth + 1, seen);
        } catch (error) {
          out[key] = "[Unserializable: " + (error && error.message ? error.message : String(error)) + "]";
        }
        copied += 1;
      }
      if (truncated) out.__truncatedKeys = true;
      return out;
    } finally {
      seen.delete(value);
    }
  };
  const textOf = (value) => {
    if (typeof value === "string") return truncateString(value, maxArgStringChars);
    if (value instanceof Error) return truncateString(value.stack || value.message || String(value), maxArgStringChars);
    try {
      const json = JSON.stringify(snapshotValue(value));
      if (json !== undefined) return truncateString(json, maxArgStringChars);
    } catch {}
    try {
      return truncateString(String(value), maxArgStringChars);
    } catch {
      return "[unprintable]";
    }
  };
  const root = globalThis;
  if (!root[key]) {
    const entries = [];
    const original = {};
    const push = (level, args) => {
      const argList = args.slice(0, maxArgs);
      const snapshotArgs = argList.map((value) => snapshotValue(value));
      if (args.length > maxArgs) snapshotArgs.push({ __truncatedArgs: args.length - maxArgs });
      entries.push({
        level,
        text: truncateString(
          argList.map(textOf).join(" ") + (args.length > maxArgs ? " ...[" + (args.length - maxArgs) + " more args]" : ""),
          maxTextChars,
        ),
        args: snapshotArgs,
        timestamp: Date.now(),
      });
      if (entries.length > 500) entries.splice(0, entries.length - 500);
    };
    for (const level of levels) {
      const current = console && console[level];
      if (typeof current !== "function") continue;
      original[level] = current.bind(console);
      console[level] = (...args) => {
        try {
          push(level, args);
        } catch {}
        return original[level](...args);
      };
    }
    Object.defineProperty(root, key, {
      value: { entries, original },
      configurable: false,
    });
  }
  const entries = Array.isArray(root[key].entries) ? root[key].entries : [];
  const rows = entries.slice(Math.max(0, entries.length - maxEntries));
  if (clearAfterRead) entries.splice(0, entries.length);
  return rows;
})()
`;
}
