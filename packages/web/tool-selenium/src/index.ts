/**
 * Selenium PowerShell automation tool plugin for DeepSeek Harness.
 *
 * @module @deepseek-ai/dsh-tool-selenium
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applySeleniumTool, DEFAULT_SELENIUM_TIMEOUT_MS } from './selenium.ts'

export { applySeleniumTool, formatSeleniumOutput, resolveSeleniumModulePath, runSeleniumScript } from './selenium.ts'
export type { SeleniumExecuteArgs, SeleniumExecuteResultValue } from './selenium.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-selenium'

/** Services required by the Selenium tool. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config schema. */
export interface Config {
  /** Enable selenium_execute tool. Defaults to true on win32, false otherwise. */
  enabled?: boolean
  /** Default execution timeout in ms. Defaults to 60000ms. */
  defaultTimeoutMs?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(process.platform === 'win32'),
  defaultTimeoutMs: z.number().default(DEFAULT_SELENIUM_TIMEOUT_MS),
})

type ResolvedConfig = Required<Config>

/**
 * Register selenium_execute tool in the Cordis context.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.enabled !== false) {
    applySeleniumTool(ctx, resolved.defaultTimeoutMs)
  }
}
