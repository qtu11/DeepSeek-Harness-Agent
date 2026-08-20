/**
 * Web Article Extractor tool plugin for DeepSeek Harness.
 * Inspired by Qwen-Agent web extractor architecture.
 *
 * @module @deepseek-ai/dsh-tool-web-extractor
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyWebExtractorTool, DEFAULT_WEB_EXTRACT_TIMEOUT_MS } from './extractor.ts'

export { applyWebExtractorTool, cleanHtmlToMarkdown, fetchAndExtractUrl, formatWebExtractOutput } from './extractor.ts'
export type { WebExtractArgs, WebExtractResultValue } from './extractor.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-web-extractor'

/** Services required by the Web Extractor tool. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config schema. */
export interface Config {
  /** Enable web_extract tool. Defaults to true. */
  enabled?: boolean
  /** Default request timeout in ms. Defaults to 25000ms. */
  defaultTimeoutMs?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  defaultTimeoutMs: z.number().default(DEFAULT_WEB_EXTRACT_TIMEOUT_MS),
})

type ResolvedConfig = Required<Config>

/**
 * Register web_extract tool in the Cordis context.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.enabled !== false) {
    applyWebExtractorTool(ctx, resolved.defaultTimeoutMs)
  }
}
