/**
 * Persistent Browser Automation Manager using Playwright.
 * Launches and controls Chrome / Edge instances on the host system.
 * Inspired by Open-Browser-Use architecture with Set-of-Mark visual element highlighting.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'
import { existsSync } from 'node:fs'

export interface BrowserManagerOptions {
  headless?: boolean | undefined
  defaultTimeoutMs?: number | undefined
}

export interface ClickTarget {
  selector?: string | undefined
  text?: string | undefined
  x?: number | undefined
  y?: number | undefined
  elementIndex?: number | undefined
}

export interface ScreenshotOptions {
  fullPage?: boolean | undefined
  path?: string | undefined
  highlightElements?: boolean | undefined
}

export interface ScreenshotResult {
  base64: string
  path?: string | undefined
  message: string
  annotatedElementsCount?: number
}

export interface InteractiveElementInfo {
  index: number
  tagName: string
  text: string
  selector: string
  ariaLabel?: string
  x: number
  y: number
  width: number
  height: number
}

export class BrowserManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private activePage: Page | null = null

  constructor(private readonly options: BrowserManagerOptions = {}) {}

  /** Locate installed Chrome or Edge executable on the host system. */
  private getExecutablePath(): string | undefined {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
    for (const path of candidates) {
      if (existsSync(path)) return path
    }
    return undefined
  }

  /** Ensure active page is available, launching browser if needed. */
  async ensurePage(headless = false): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage
    }

    if (!this.browser || !this.browser.isConnected()) {
      const executablePath = this.getExecutablePath()
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: headless || (this.options.headless ?? false),
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-default-browser-check',
          '--start-maximized',
        ],
      }
      if (executablePath) {
        launchOptions.executablePath = executablePath
      }
      this.browser = await chromium.launch(launchOptions)
      this.context = await this.browser.newContext({
        viewport: null,
      })
      this.activePage = await this.context.newPage()
      this.activePage.setDefaultTimeout(this.options.defaultTimeoutMs ?? 30_000)
    } else if (!this.activePage || this.activePage.isClosed()) {
      if (!this.context) {
        this.context = await this.browser.newContext({ viewport: null })
      }
      this.activePage = await this.context.newPage()
      this.activePage.setDefaultTimeout(this.options.defaultTimeoutMs ?? 30_000)
    }

    return this.activePage
  }

  /** Navigate to URL. */
  async navigate(url: string, headless = false): Promise<{ url: string; title: string; status: number | null }> {
    const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
    const page = await this.ensurePage(headless)
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const title = await page.title()
    return {
      url: page.url(),
      title,
      status: response ? response.status() : null,
    }
  }

  /**
   * Set-of-Mark: Highlight all interactive elements with visual numeric badges
   * for vision-based reasoning.
   */
  async highlightInteractiveElements(): Promise<InteractiveElementInfo[]> {
    const page = await this.ensurePage()
    const script = `
      (() => {
        // Remove existing overlays
        const oldOverlays = document.querySelectorAll('.dsh-som-badge');
        oldOverlays.forEach(el => el.remove());

        const interactiveSelectors = [
          'button', 'a[href]', 'input', 'select', 'textarea',
          '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="tab"]',
          '[onclick]', '[tabindex]:not([tabindex="-1"])'
        ];

        const elements = document.querySelectorAll(interactiveSelectors.join(','));
        const results = [];
        let index = 1;

        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(el).visibility === 'hidden' || window.getComputedStyle(el).display === 'none') {
            return;
          }

          const badge = document.createElement('div');
          badge.className = 'dsh-som-badge';
          badge.innerText = index.toString();
          badge.style.position = 'fixed';
          badge.style.left = Math.max(0, rect.left) + 'px';
          badge.style.top = Math.max(0, rect.top) + 'px';
          badge.style.background = '#e11d48';
          badge.style.color = '#ffffff';
          badge.style.fontSize = '11px';
          badge.style.fontWeight = 'bold';
          badge.style.padding = '1px 5px';
          badge.style.borderRadius = '3px';
          badge.style.border = '1px solid #ffffff';
          badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
          badge.style.zIndex = '2147483647';
          badge.style.pointerEvents = 'none';
          document.body.appendChild(badge);

          const tag = el.tagName.toLowerCase();
          const text = (el.innerText || el.getAttribute('placeholder') || el.getAttribute('value') || '').slice(0, 50).trim();
          const aria = el.getAttribute('aria-label') || undefined;

          results.push({
            index,
            tagName: tag,
            text,
            ariaLabel: aria,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });

          index++;
        });

        return results;
      })()
    `
    return await page.evaluate(script) as InteractiveElementInfo[]
  }

  /** Remove Set-of-Mark visual badges. */
  async removeHighlightBadges(): Promise<void> {
    const page = await this.ensurePage()
    await page.evaluate(`
      (() => {
        const oldOverlays = document.querySelectorAll('.dsh-som-badge');
        oldOverlays.forEach(el => el.remove());
      })()
    `).catch(() => undefined)
  }

  /** Click on element by selector, text, coordinates, or Set-of-Mark element index. */
  async click(target: ClickTarget): Promise<{ success: boolean; message: string }> {
    const page = await this.ensurePage()
    if (target.x !== undefined && target.y !== undefined) {
      await page.mouse.click(target.x, target.y)
      return { success: true, message: `Clicked at coordinates (${target.x}, ${target.y})` }
    }
    if (target.selector) {
      await page.click(target.selector, { timeout: 15_000 })
      return { success: true, message: `Clicked selector: ${target.selector}` }
    }
    if (target.text) {
      await page.getByText(target.text, { exact: false }).first().click({ timeout: 15_000 })
      return { success: true, message: `Clicked text: "${target.text}"` }
    }
    throw new Error('Click requires either selector, text, or (x, y) coordinates')
  }

  /** Type text into an element. */
  async type(
    selector: string,
    text: string,
    options: { clear?: boolean | undefined; pressEnter?: boolean | undefined } = {},
  ): Promise<{ success: boolean; message: string }> {
    const page = await this.ensurePage()
    const locator = page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout: 15_000 })
    if (options.clear !== false) {
      await locator.fill('')
    }
    await locator.fill(text)
    if (options.pressEnter === true) {
      await page.keyboard.press('Enter')
    }
    return { success: true, message: `Typed into ${selector}: "${text}"` }
  }

  /** Capture screenshot as base64 string, optionally with visual Set-of-Mark badges. */
  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const page = await this.ensurePage()
    let count = 0

    if (options.highlightElements === true) {
      const items = await this.highlightInteractiveElements()
      count = items.length
    }

    const screenshotOpts: Parameters<Page['screenshot']>[0] = {
      fullPage: options.fullPage ?? false,
    }
    if (options.path) {
      screenshotOpts.path = options.path
    }
    const buffer = await page.screenshot(screenshotOpts)
    const base64 = buffer.toString('base64')

    if (options.highlightElements === true) {
      await this.removeHighlightBadges()
    }

    return {
      base64,
      path: options.path,
      annotatedElementsCount: count,
      message: options.path ? `Screenshot saved to ${options.path}` : `Screenshot captured (${(buffer.length / 1024).toFixed(1)} KB)${count > 0 ? `, annotated ${count} interactive elements` : ''}`,
    }
  }

  /** Execute JavaScript inside page context. */
  async evaluate(script: string): Promise<unknown> {
    const page = await this.ensurePage()
    return await page.evaluate(script)
  }

  /** Extract page content (text/markdown/html). */
  async getContent(selector?: string | undefined, format: 'text' | 'html' = 'text'): Promise<string> {
    const page = await this.ensurePage()
    if (selector) {
      const locator = page.locator(selector).first()
      return format === 'html' ? await locator.innerHTML() : await locator.innerText()
    }
    if (format === 'html') {
      return await page.content()
    }
    return await page.innerText('body')
  }

  /** Close browser and cleanup. */
  async close(): Promise<void> {
    if (this.activePage && !this.activePage.isClosed()) {
      await this.activePage.close().catch(() => undefined)
    }
    if (this.context) {
      await this.context.close().catch(() => undefined)
    }
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close().catch(() => undefined)
    }
    this.activePage = null
    this.context = null
    this.browser = null
  }
}
