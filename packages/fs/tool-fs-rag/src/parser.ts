/**
 * Model-facing `doc_parse` tool: parses structured files (Markdown, Code,
 * Text, JSON, YAML) into organized sections and chunk metadata.
 *
 * @module @deepseek-ai/dsh-tool-fs-rag/parser
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import { chunkDocument } from './rag-core.ts'

export const DOC_PARSE_DEFAULT_CHUNK_SIZE = 1500

/** Arguments for doc_parse. */
export interface DocParseArgs {
  file_path: string
  chunk_size?: number
}

/** Output value shape for doc_parse. */
export interface DocParseResultValue {
  filePath: string
  totalLines: number
  totalChars: number
  totalChunks: number
  chunks: Array<{
    chunkIndex: number
    startLine: number
    endLine: number
    preview: string
  }>
}

/** Format parsed doc output into readable summary. */
export function formatDocParseOutput(value: DocParseResultValue): string {
  const lines = [
    `Document: ${value.filePath}`,
    `Total Lines: ${value.totalLines} | Total Characters: ${value.totalChars} | Total Chunks: ${value.totalChunks}`,
    '',
    'Chunk Overview:',
  ]

  for (const c of value.chunks) {
    lines.push(`  [Chunk ${c.chunkIndex + 1}] Lines ${c.startLine}-${c.endLine}: "${c.preview.replace(/\n/g, ' ')}"`)
  }

  return lines.join('\n')
}

/** Register doc_parse tool in Cordis context. */
export function applyDocParseTool(
  ctx: Context,
  defaultChunkSize = DOC_PARSE_DEFAULT_CHUNK_SIZE,
): void {
  ctx.systemPrompt.section({
    name: 'tool:doc_parse',
    order: 106,
    text: 'Use doc_parse to inspect the structure, section count, and outline of a document before detailed reading or RAG retrieval.',
  })

  ctx.tools.register(defineTool({
    name: 'doc_parse',
    description: 'Parse a document into structured chunks and section summaries.',
    parameters: {
      file_path: {
        type: 'string',
        required: true,
        description: 'File path in workspace to parse.',
      },
      chunk_size: {
        type: 'number',
        description: `Chunk size in characters for chunking. Defaults to ${defaultChunkSize}.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          filePath: { type: 'string', required: true },
          totalLines: { type: 'integer', required: true },
          totalChars: { type: 'integer', required: true },
          totalChunks: { type: 'integer', required: true },
          chunks: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                chunkIndex: { type: 'integer', required: true },
                startLine: { type: 'integer', required: true },
                endLine: { type: 'integer', required: true },
                preview: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatDocParseOutput(value) }],
    },
    presentCall: (args): GenericCallView => ({
      card: 'generic',
      kind: 'read',
      title: `Doc Parse: ${String(args.file_path ?? '')}`,
      rawInput: String(args.file_path ?? ''),
    }),
    presentResult: (args): GenericCallView => ({
      card: 'generic',
      kind: 'read',
      title: `Doc Parse: ${String(args.file_path ?? '')}`,
      rawInput: String(args.file_path ?? ''),
    }),
    execute: async (args): Promise<DocParseResultValue> => {
      const rawArgs = args as unknown as DocParseArgs
      if (!rawArgs.file_path || typeof rawArgs.file_path !== 'string') {
        throw new Error('doc_parse: file_path must be a non-empty string')
      }

      const chunkSize = rawArgs.chunk_size ?? defaultChunkSize
      const resolved = path.isAbsolute(rawArgs.file_path)
        ? rawArgs.file_path
        : path.resolve(process.cwd(), rawArgs.file_path)

      if (!fs.existsSync(resolved)) {
        throw new Error(`doc_parse: file not found: "${rawArgs.file_path}"`)
      }

      const content = fs.readFileSync(resolved, 'utf8')
      const lines = content.split(/\r?\n/)
      const relPath = path.relative(process.cwd(), resolved).replace(/\\/g, '/')
      const chunks = chunkDocument(relPath, content, chunkSize)

      return {
        filePath: relPath,
        totalLines: lines.length,
        totalChars: content.length,
        totalChunks: chunks.length,
        chunks: chunks.map(c => ({
          chunkIndex: c.chunkIndex,
          startLine: c.startLine,
          endLine: c.endLine,
          preview: c.text.slice(0, 100).trim(),
        })),
      }
    },
  }))
}
