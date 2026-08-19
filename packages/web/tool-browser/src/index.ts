/**
 * Model-facing Browser Automation & Visual Inspection Tool Plugin.
 * Enables DeepSeek Harness to open real Chrome/Edge browsers, take screenshots,
 * click elements, type text, execute JavaScript, and interact with web pages.
 * @module @deepseek-ai/dsh-tool-browser
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { BrowserManager } from './browser-manager.ts'
import { registerBrowserTools } from './tools.ts'

export const name = 'tool-browser'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  enabled?: boolean
  headless?: boolean
  defaultTimeoutMs?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  headless: z.boolean().default(false),
  defaultTimeoutMs: z.number().default(30_000),
})

export function apply(ctx: Context, config: Config): () => Promise<void> {
  if (config.enabled === false) return async () => undefined

  const manager = new BrowserManager({
    headless: config.headless ?? false,
    defaultTimeoutMs: config.defaultTimeoutMs ?? 30_000,
  })

  const unregisterPrompt = ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 115,
    text: [
      'You have full browser automation capabilities via `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_eval`, `browser_content`, and `browser_close`.',
      'You can open Chrome/Edge, navigate websites, inspect UI layouts visually via screenshots, click buttons, fill forms, and evaluate JavaScript in real time.',
      'On Windows PowerShell, you can also use `Import-Module tools/selenium-powershell/Selenium.psd1` for automated Selenium cmdlets.',
    ].join(' '),
  })

  const unregisterTools = registerBrowserTools(ctx, manager)

  return async () => {
    try {
      unregisterPrompt()
    } catch {
      // ignore
    }
    try {
      unregisterTools()
    } catch {
      // ignore
    }
    await manager.close()
  }
}
