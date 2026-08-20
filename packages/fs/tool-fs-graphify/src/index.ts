/**
 * Deterministic AST Code Knowledge Graph and Work Memory reflection engine (Graphify) plugin.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyGraphifyTools } from './tools.ts'
import { applyGraphifyContextInjector } from './context-injector.ts'

export { applyGraphifyTools } from './tools.ts'
export { applyGraphifyContextInjector } from './context-injector.ts'
export { scanCodebase } from './scanner.ts'
export { buildCodebaseGraph, queryNeighborhood, queryShortestPath } from './graph.ts'
export { saveMemoryResult, loadAllMemories } from './memory.ts'
export { reflectWorkMemory } from './reflect.ts'
export type { CodebaseGraph, GraphNode, GraphEdge, MemoryEntry, LessonItem } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-fs-graphify'

/** Services required by the Graphify tool suite. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config schema. */
export interface Config {
  /** Enable Graphify tools (graphify_scan, graphify_query, graphify_save_result, graphify_reflect). Defaults to true. */
  tools?: boolean
  /** Auto-inject GRAPH_REPORT.md and LESSONS.md into system prompts. Defaults to true. */
  autoContext?: boolean
}

export const Config: z<Config> = z.object({
  tools: z.boolean().default(true),
  autoContext: z.boolean().default(true),
})

type ResolvedConfig = Required<Config>

/**
 * Register Graphify tools and context injector in Cordis context.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.tools) {
    applyGraphifyTools(ctx)
  }
  if (resolved.autoContext) {
    applyGraphifyContextInjector(ctx)
  }
}
