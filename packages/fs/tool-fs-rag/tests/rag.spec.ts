import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolFsRag from '@deepseek-ai/dsh-tool-fs-rag'
import { chunkDocument, rankChunksBM25, tokenizeText } from '../src/rag-core.ts'

describe('tool-fs-rag RAG retrieval & parser', () => {
  it('tokenizes text correctly with multilingual terms', () => {
    const tokens = tokenizeText('DeepSeek Harness Qwen-Agent RAG retrieval và tìm kiếm tài liệu 123')
    expect(tokens).toContain('deepseek')
    expect(tokens).toContain('harness')
    expect(tokens).toContain('qwen-agent')
    expect(tokens).toContain('rag')
    expect(tokens).toContain('retrieval')
    expect(tokens).toContain('kiếm')
    expect(tokens).toContain('liệu')
  })

  it('chunks documents with line tracking and overlap', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Important documentation content section.`).join('\n')
    const chunks = chunkDocument('test.md', text, 300, 50)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]!.startLine).toBe(1)
    expect(chunks[0]!.text).toContain('Line 1')
  })

  it('ranks relevant chunks using BM25', () => {
    const chunks = [
      {
        filePath: 'doc1.md',
        chunkIndex: 0,
        startLine: 1,
        endLine: 5,
        text: 'This section explains PostgreSQL database connection pooling and query optimization.',
        tokens: tokenizeText('This section explains PostgreSQL database connection pooling and query optimization.'),
      },
      {
        filePath: 'doc2.md',
        chunkIndex: 0,
        startLine: 1,
        endLine: 5,
        text: 'Frontend state management with Zustand and Next.js rendering lifecycle.',
        tokens: tokenizeText('Frontend state management with Zustand and Next.js rendering lifecycle.'),
      },
      {
        filePath: 'doc3.md',
        chunkIndex: 0,
        startLine: 1,
        endLine: 5,
        text: 'PostgreSQL database transaction MVCC and WAL replication details.',
        tokens: tokenizeText('PostgreSQL database transaction MVCC and WAL replication details.'),
      },
    ]

    const matches = rankChunksBM25(chunks, 'PostgreSQL database transaction', 2)
    expect(matches.length).toBe(2)
    expect(matches[0]!.filePath).toBe('doc3.md')
    expect(matches[0]!.score).toBeGreaterThan(0)
  })

  it('mounts in Cordis context and registers rag_search and doc_parse tools', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(toolFsRag, { retrieval: true, parser: true })

    const toolNames = ctx.tools.schemas().map(s => s.name)
    expect(toolNames).toContain('rag_search')
    expect(toolNames).toContain('doc_parse')

    await fiber.dispose()
  })
})
