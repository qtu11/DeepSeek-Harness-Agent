/**
 * RAG retrieval and document intelligence tool plugin for DeepSeek Harness.
 * Inspired by Qwen-Agent RAG architecture.
 *
 * @module @deepseek-ai/dsh-tool-fs-rag
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyRagSearchTool, RAG_DEFAULT_CHUNK_SIZE, RAG_DEFAULT_MAX_CHUNKS } from './retrieval.ts'
import { applyDocParseTool, DOC_PARSE_DEFAULT_CHUNK_SIZE } from './parser.ts'

export { applyRagSearchTool, formatRagOutput } from './retrieval.ts'
export type { RagSearchArgs } from './retrieval.ts'
export { applyDocParseTool, formatDocParseOutput } from './parser.ts'
export type { DocParseArgs, DocParseResultValue } from './parser.ts'
export { chunkDocument, loadAndChunkFiles, rankChunksBM25, tokenizeText } from './rag-core.ts'
export type { DocumentChunk, RagSearchResultItem } from './rag-core.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-fs-rag'

/** Services required by the RAG tool suite. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config schema. */
export interface Config {
  /** Register `rag_search` tool. Defaults to true. */
  retrieval?: boolean
  /** Register `doc_parse` tool. Defaults to true. */
  parser?: boolean
  /** Default maximum top chunks returned by rag_search. */
  defaultMaxChunks?: number
  /** Default chunk size in characters. */
  defaultChunkSize?: number
}

export const Config: z<Config> = z.object({
  retrieval: z.boolean().default(true),
  parser: z.boolean().default(true),
  defaultMaxChunks: z.number().default(RAG_DEFAULT_MAX_CHUNKS),
  defaultChunkSize: z.number().default(RAG_DEFAULT_CHUNK_SIZE),
})

type ResolvedConfig = Required<Config>

/**
 * Register enabled RAG and document intelligence tools in the context.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.retrieval) {
    applyRagSearchTool(ctx, resolved.defaultMaxChunks, resolved.defaultChunkSize)
  }
  if (resolved.parser) {
    applyDocParseTool(ctx, resolved.defaultChunkSize || DOC_PARSE_DEFAULT_CHUNK_SIZE)
  }
}
