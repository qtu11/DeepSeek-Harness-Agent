/**
 * Python Code Interpreter tool plugin for DeepSeek Harness.
 * Inspired by Qwen-Agent code interpreter architecture.
 *
 * @module @deepseek-ai/dsh-tool-python-interpreter
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyPythonInterpreterTool, DEFAULT_PYTHON_TIMEOUT_MS } from './interpreter.ts'

export { applyPythonInterpreterTool, formatPythonOutput, runPythonCode } from './interpreter.ts'
export type { PythonExecuteArgs, PythonExecuteResultValue } from './interpreter.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-python-interpreter'

/** Services required by the Python interpreter tool. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config schema. */
export interface Config {
  /** Enable python_execute tool. Defaults to true. */
  enabled?: boolean
  /** Default execution timeout in ms. Defaults to 30000ms. */
  defaultTimeoutMs?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  defaultTimeoutMs: z.number().default(DEFAULT_PYTHON_TIMEOUT_MS),
})

type ResolvedConfig = Required<Config>

/**
 * Register python_execute tool in the Cordis context.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.enabled !== false) {
    applyPythonInterpreterTool(ctx, resolved.defaultTimeoutMs)
  }
}
