import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const packageRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

class EventTarget {
  listeners = [];

  addListener(listener) {
    this.listeners.push(listener);
  }

  addEventListener(type, listener) {
    this.listeners.push({ type, listener });
  }

  removeEventListener(type, listener) {
    this.listeners = this.listeners.filter((row) => row.type !== type || row.listener !== listener);
  }

  emit(message) {
    const responses = [];
    for (const listener of this.listeners) {
      if (typeof listener === "function") listener(message, {}, (response) => responses.push(response));
    }
    return responses;
  }
}

class FakeElement {
  style = {};
  attributes = new Map();
  children = [];
  parent = null;
  shadowChildren = [];
  id = "";

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  attachShadow() {
    return {
      append: (...children) => {
        for (const child of children) {
          child.parent = this;
          this.shadowChildren.push(child);
        }
      },
    };
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
}

delete globalThis.__OBU_CURSOR_CONTENT_SCRIPT_INSTALLED__;
delete globalThis.__OBU_CURSOR_CONTENT_SCRIPT_HANDLE_MESSAGE__;

const runtimeMessages = new EventTarget();
const documentEvents = new EventTarget();
const windowEvents = new EventTarget();
const documentElement = new FakeElement();
const sentRuntimeMessages = [];
const frameCallbacks = new Map();
let frameId = 1;
let fakeNow = 0;

Object.defineProperty(globalThis, "performance", {
  value: { now: () => fakeNow },
  configurable: true,
});
globalThis.document = {
  documentElement,
  createElement() {
    return new FakeElement();
  },
  addEventListener: (...args) => documentEvents.addEventListener(...args),
  removeEventListener: (...args) => documentEvents.removeEventListener(...args),
};
globalThis.addEventListener = (...args) => windowEvents.addEventListener(...args);
globalThis.removeEventListener = (...args) => windowEvents.removeEventListener(...args);
globalThis.innerWidth = 100;
globalThis.innerHeight = 100;
globalThis.visualViewport = { width: 100, height: 100 };
globalThis.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = (callback) => {
  const id = frameId++;
  frameCallbacks.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  frameCallbacks.delete(id);
};
globalThis.chrome = {
  runtime: {
    onMessage: runtimeMessages,
    async sendMessage(message) {
      sentRuntimeMessages.push(message);
      return { ok: true };
    },
  },
};

await import(`${pathToFileURL(path.join(packageRoot, "dist", "cursor.js")).href}?animation=${Date.now()}`);

runtimeMessages.emit({
  type: "OBU_TAKEOVER_STATE",
  active: true,
  lockInputs: true,
  sessionId: "session",
  turnId: "turn",
});
assert.equal(documentElement.children.length, 1);
const host = documentElement.children[0];
const cursor = host.shadowChildren[2];
assert.equal(cursor.style.transform, "translate3d(50px, 50px, 0)");

runtimeMessages.emit({ type: "OBU_CURSOR_MOVE", x: 10, y: 10, sequence: 1, sessionId: "session", turnId: "turn" });
assert.notEqual(cursor.style.transform, "translate3d(10px, 10px, 0)");
assert.ok(frameCallbacks.size > 0);
runFramesAt(16);
assert.notEqual(cursor.style.transform, "translate3d(50px, 50px, 0)");
assert.notEqual(cursor.style.transform, "translate3d(10px, 10px, 0)");
assert.equal(cursorArrived(1), false);

const inFlightPoint = parseTranslate(cursor.style.transform);
const microTarget = { x: inFlightPoint.x + 1, y: inFlightPoint.y };
fakeNow = 17;
runtimeMessages.emit({
  type: "OBU_CURSOR_MOVE",
  x: microTarget.x,
  y: microTarget.y,
  sequence: 2,
  sessionId: "session",
  turnId: "turn",
});
assert.equal(cursor.style.transform, `translate3d(${microTarget.x}px, ${microTarget.y}px, 0)`);
assert.equal(cursorArrived(1), false);
assert.equal(cursorArrived(2), true);
runFramesAt(18);
assert.equal(cursor.style.transform, `translate3d(${microTarget.x}px, ${microTarget.y}px, 0)`);
assert.equal(cursorArrived(1), false);

function runFramesAt(now) {
  fakeNow = now;
  const pending = [...frameCallbacks.entries()];
  frameCallbacks.clear();
  for (const [, callback] of pending) callback(now);
}

function cursorArrived(sequence) {
  return sentRuntimeMessages.some((message) => message.type === "OBU_CURSOR_ARRIVED" && message.sequence === sequence);
}

function parseTranslate(transform) {
  const match = /^translate3d\((-?\d+)px, (-?\d+)px, 0\)$/.exec(transform);
  assert.ok(match, `unexpected cursor transform: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}
