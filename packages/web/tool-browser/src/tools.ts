/**
 * Model-facing Browser Tools for DeepSeek Harness.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { BrowserManager, type ClickTarget, type ScreenshotOptions } from './browser-manager.ts'

const JSON_OUTPUT = {
  schema: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      text: { type: 'string' as const, required: true },
    },
  },
  render: (_args: unknown, value: Record<string, unknown>) => [{
    type: 'text' as const,
    text: typeof value['text'] === 'string' ? value['text'] : JSON.stringify(value),
  }],
} as const

export function registerBrowserTools(ctx: Context, manager: BrowserManager): () => void {
  const disposers: Array<() => void> = []

  // 1. browser_navigate
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Launch real Chrome/Edge browser and navigate to a website URL.',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The target URL or domain to open (e.g. "https://github.com" or "google.com").',
      },
      headless: {
        type: 'boolean',
        description: 'Whether to run headless (default: false, runs visible Chrome on desktop).',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const url = String(args.url || '').trim()
      if (!url) throw new Error('url must be a non-empty string')
      const result = await manager.navigate(url, args.headless === true)
      return {
        text: `Navigated to ${result.url}\nTitle: ${result.title}\nStatus: ${result.status ?? 'OK'}`,
        url: result.url,
        title: result.title,
        status: result.status,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 2. browser_click
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_click',
    description: 'Click on a button, link, or element on the active browser page by CSS selector, visible text, or (X, Y) coordinates.',
    parameters: {
      selector: {
        type: 'string',
        description: 'CSS selector of the element to click (e.g. "button#submit", "a.nav-link").',
      },
      text: {
        type: 'string',
        description: 'Visible text of the button or link to click (e.g. "Sign in", "Submit").',
      },
      x: {
        type: 'number',
        description: 'Horizontal X coordinate to click on the screen.',
      },
      y: {
        type: 'number',
        description: 'Vertical Y coordinate to click on the screen.',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const target: ClickTarget = {}
      if (typeof args.selector === 'string' && args.selector.length > 0) target.selector = args.selector
      if (typeof args.text === 'string' && args.text.length > 0) target.text = args.text
      if (typeof args.x === 'number') target.x = args.x
      if (typeof args.y === 'number') target.y = args.y
      const result = await manager.click(target)
      return {
        text: result.message,
        success: result.success,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 3. browser_type
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Type text into an input field or textarea on the active browser page.',
    parameters: {
      selector: {
        type: 'string',
        required: true,
        description: 'CSS selector of the input element (e.g. "input[name=q]", "#search-box").',
      },
      text: {
        type: 'string',
        required: true,
        description: 'The text to type into the field.',
      },
      clear: {
        type: 'boolean',
        description: 'Whether to clear existing text before typing (default: true).',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Whether to press Enter after typing (default: false).',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const selector = String(args.selector || '').trim()
      const text = String(args.text ?? '')
      if (!selector) throw new Error('selector must be specified')
      const result = await manager.type(selector, text, {
        clear: args.clear !== false,
        pressEnter: args.pressEnter === true,
      })
      return {
        text: result.message,
        success: result.success,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 4. browser_screenshot
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_screenshot',
    description: 'Capture a screenshot of the active browser window or webpage to visually inspect its UI and layout.',
    parameters: {
      fullPage: {
        type: 'boolean',
        description: 'Whether to capture the entire scrollable page (default: false).',
      },
      path: {
        type: 'string',
        description: 'Optional file path on disk to save the image (e.g. "screenshot.png").',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const opts: ScreenshotOptions = {
        fullPage: args.fullPage === true,
      }
      if (typeof args.path === 'string' && args.path.length > 0) {
        opts.path = args.path
      }
      const result = await manager.screenshot(opts)
      return {
        text: `${result.message}\nBase64 preview length: ${result.base64.length} chars`,
        path: result.path ?? null,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 5. browser_content
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_content',
    description: 'Extract visible text or HTML content from the active browser webpage or a specific DOM selector.',
    parameters: {
      selector: {
        type: 'string',
        description: 'Optional CSS selector to extract content from a specific container.',
      },
      format: {
        type: 'string',
        description: 'Format to return: "text" (default) or "html".',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const format = args.format === 'html' ? 'html' : 'text'
      const content = await manager.getContent(
        typeof args.selector === 'string' ? args.selector : undefined,
        format,
      )
      const maxChars = 20_000
      const truncated = content.length > maxChars ? `${content.slice(0, maxChars)}\n...[Truncated, total ${content.length} chars]` : content
      return {
        text: truncated,
        totalChars: content.length,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 6. browser_eval
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_eval',
    description: 'Execute custom JavaScript in the active browser page context and return the result.',
    parameters: {
      script: {
        type: 'string',
        required: true,
        description: 'JavaScript code or expression to evaluate (e.g. "document.title", "window.location.href").',
      },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args) {
      const script = String(args.script || '').trim()
      if (!script) throw new Error('script must be specified')
      const result = await manager.evaluate(script)
      return {
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        value: result as JsonValue,
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  // 7. browser_close
  disposers.push(ctx.tools.register(defineTool({
    name: 'browser_close',
    description: 'Close the active Chrome/Edge browser window and cleanup session.',
    parameters: {},
    output: JSON_OUTPUT,
    isConcurrencySafe: () => false,
    async execute() {
      await manager.close()
      return {
        text: 'Browser closed successfully.',
      } as unknown as { text: string } & Record<string, JsonValue>
    },
  })))

  return () => {
    for (const dispose of disposers.reverse()) {
      dispose()
    }
  }
}
