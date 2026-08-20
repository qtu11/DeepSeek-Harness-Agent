/**
 * Model-facing `rag_search` tool: retrieves top relevant document chunks
 * across specified files using BM25 ranking.
 *
 * @module @deepseek-ai/dsh-tool-fs-rag/retrieval
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import { loadAndChunkFiles, rankChunksBM25 } from './rag-core.ts'
import type { RagSearchResultItem } from './rag-core.ts'

export const RAG_DEFAULT_MAX_CHUNKS = 5
export const RAG_DEFAULT_CHUNK_SIZE = 1500

/** Arguments for rag_search. */
export interface RagSearchArgs {
  query: string
  files: string[]
  max_chunks?: number
  chunk_size?: number
}

/** Output payload for rag_search. */
export interface RagSearchResultValue {
  query: string
  total_chunks_scanned: number
  matches: RagSearchResultItem[]
}

/** Format ranked search results into model-facing reference tags. */
export function formatRagOutput(results: readonly RagSearchResultItem[]): string {
  if (results.length === 0) {
    return 'No relevant document chunks found matching the query.'
  }

  const sections = results.map((item, idx) => {
    return [
      `<doc_reference index="${idx + 1}" file="${item.filePath}" lines="${item.startLine}-${item.endLine}" score="${item.score}">`,
      item.snippet,
      '</doc_reference>',
    ].join('\n')
  })

  return `Found ${results.length} relevant document reference(s):\n\n${sections.join('\n\n')}`
}

/** Register rag_search tool in Cordis context. */
export function applyRagSearchTool(
  ctx: Context,
  defaultMaxChunks = RAG_DEFAULT_MAX_CHUNKS,
  defaultChunkSize = RAG_DEFAULT_CHUNK_SIZE,
): void {
  ctx.systemPrompt.section({
    name: 'tool:rag_search',
    order: 105,
    text: 'Use rag_search to perform semantic retrieval over large documents, files, or manuals to extract relevant paragraphs before answering.',
  })

  ctx.tools.register(defineTool({
    name: 'rag_search',
    description: 'Retrieve relevant document excerpts and paragraphs matching a search query using BM25 relevance ranking.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'The search query or question to retrieve relevant information for.',
      },
      files: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'List of target file paths in the workspace to retrieve from.',
      },
      max_chunks: {
        type: 'number',
        description: `Maximum number of top chunks to return. Defaults to ${defaultMaxChunks}.`,
      },
      chunk_size: {
        type: 'number',
        description: `Segment size in characters for chunking. Defaults to ${defaultChunkSize}.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', required: true },
          total_chunks_scanned: { type: 'integer', required: true },
          matches: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                filePath: { type: 'string', required: true },
                chunkIndex: { type: 'integer', required: true },
                startLine: { type: 'integer', required: true },
                endLine: { type: 'integer', required: true },
                score: { type: 'number', required: true },
                snippet: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatRagOutput(value.matches) }],
    },
    presentCall: (args): GenericCallView => ({
      card: 'generic',
      kind: 'search',
      title: `RAG: ${String(args.query ?? '')}`,
      rawInput: String(args.query ?? ''),
    }),
    presentResult: (args): GenericCallView => ({
      card: 'generic',
      kind: 'search',
      title: `RAG: ${String(args.query ?? '')}`,
      rawInput: String(args.query ?? ''),
    }),
    execute: async (args): Promise<RagSearchResultValue> => {
      const rawArgs = args as unknown as RagSearchArgs
      if (!rawArgs.query || typeof rawArgs.query !== 'string') {
        throw new Error('rag_search: query must be a non-empty string')
      }
      if (!Array.isArray(rawArgs.files) || rawArgs.files.length === 0) {
        throw new Error('rag_search: files must be a non-empty array of file paths')
      }

      const maxChunks = rawArgs.max_chunks ?? defaultMaxChunks
      const chunkSize = rawArgs.chunk_size ?? defaultChunkSize

      const chunks = loadAndChunkFiles(rawArgs.files, process.cwd(), chunkSize)
      const matches = rankChunksBM25(chunks, rawArgs.query, maxChunks)

      return {
        query: rawArgs.query,
        total_chunks_scanned: chunks.length,
        matches,
      }
    },
  }))
}
