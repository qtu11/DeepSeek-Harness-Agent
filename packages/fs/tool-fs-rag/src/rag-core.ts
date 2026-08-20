/**
 * Core text chunking, tokenization, and BM25 hybrid ranking engine for RAG.
 * Inspired by Qwen-Agent document retrieval architecture.
 *
 * @module @deepseek-ai/dsh-tool-fs-rag/rag-core
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/** One segmented document chunk. */
export interface DocumentChunk {
  /** Target file path relative to workspace. */
  filePath: string
  /** 0-based chunk index within file. */
  chunkIndex: number
  /** 1-based start line. */
  startLine: number
  /** 1-based end line. */
  endLine: number
  /** Chunk raw text content. */
  text: string
  /** Pre-tokenized terms for fast BM25 matching. */
  tokens: string[]
}

/** Ranked retrieval search result item. */
export interface RagSearchResultItem {
  filePath: string
  chunkIndex: number
  startLine: number
  endLine: number
  score: number
  snippet: string
}

/** Tokenize string into normalized lowercase terms. */
export function tokenizeText(text: string): string[] {
  if (!text) return []
  // Split on whitespace and non-alphanumeric punctuation while retaining meaningful code/word tokens
  const words = text
    .toLowerCase()
    .match(/[\p{L}\p{N}_$#@.-]+/gu) ?? []
  return words.filter(w => w.length > 1)
}

/** Segment raw text into overlapping line chunks. */
export function chunkDocument(
  filePath: string,
  content: string,
  chunkSizeChars = 1500,
  overlapChars = 200,
): DocumentChunk[] {
  const lines = content.split(/\r?\n/)
  const chunks: DocumentChunk[] = []
  if (lines.length === 0) return chunks

  let currentLines: string[] = []
  let currentChars = 0
  let chunkStartLine = 1
  let chunkIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    currentLines.push(line)
    currentChars += line.length + 1

    if (currentChars >= chunkSizeChars || i === lines.length - 1) {
      const chunkText = currentLines.join('\n')
      chunks.push({
        filePath,
        chunkIndex: chunkIndex++,
        startLine: chunkStartLine,
        endLine: i + 1,
        text: chunkText,
        tokens: tokenizeText(chunkText),
      })

      // Calculate overlap lines
      if (i < lines.length - 1) {
        let keptChars = 0
        const keptLines: string[] = []
        for (let j = currentLines.length - 1; j >= 0; j--) {
          const l = currentLines[j] ?? ''
          if (keptChars + l.length + 1 > overlapChars) break
          keptLines.unshift(l)
          keptChars += l.length + 1
        }
        currentLines = keptLines
        currentChars = keptChars
        chunkStartLine = i + 1 - currentLines.length + 1
      }
    }
  }

  return chunks
}

/**
 * Rank document chunks against a query using BM25 scoring algorithm.
 * @param chunks - Document chunks universe.
 * @param query - Search query string.
 * @param maxResults - Maximum top ranked chunks to return.
 */
export function rankChunksBM25(
  chunks: readonly DocumentChunk[],
  query: string,
  maxResults = 5,
): RagSearchResultItem[] {
  const queryTokens = tokenizeText(query)
  if (queryTokens.length === 0 || chunks.length === 0) return []

  const totalDocs = chunks.length
  let totalDocLength = 0
  const docFreq: Record<string, number> = {}

  // 1. Calculate document frequencies for query terms
  for (const chunk of chunks) {
    totalDocLength += chunk.tokens.length
    const uniqueTerms = new Set(chunk.tokens)
    for (const token of queryTokens) {
      if (uniqueTerms.has(token)) {
        docFreq[token] = (docFreq[token] ?? 0) + 1
      }
    }
  }

  const avgDocLength = totalDocLength / totalDocs || 1
  const k1 = 1.5
  const b = 0.75

  // 2. Score each chunk
  const scored: RagSearchResultItem[] = []

  for (const chunk of chunks) {
    const docLength = chunk.tokens.length
    const termCounts: Record<string, number> = {}
    for (const t of chunk.tokens) {
      termCounts[t] = (termCounts[t] ?? 0) + 1
    }

    let score = 0
    for (const qToken of queryTokens) {
      const df = docFreq[qToken] ?? 0
      if (df === 0) continue

      // Robertson-Spärck Jones IDF
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1)
      const tf = termCounts[qToken] ?? 0
      const numerator = tf * (k1 + 1)
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength))
      score += idf * (numerator / denominator)
    }

    if (score > 0) {
      scored.push({
        filePath: chunk.filePath,
        chunkIndex: chunk.chunkIndex,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        score: Math.round(score * 100) / 100,
        snippet: chunk.text,
      })
    }
  }

  // 3. Sort descending by score and slice
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxResults)
}

/** Load files from filesystem and chunk them. */
export function loadAndChunkFiles(
  filePaths: readonly string[],
  baseDir = process.cwd(),
  chunkSizeChars = 1500,
): DocumentChunk[] {
  const allChunks: DocumentChunk[] = []

  for (const rawPath of filePaths) {
    try {
      const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(baseDir, rawPath)
      if (!fs.existsSync(resolved)) continue
      const stat = fs.statSync(resolved)
      if (!stat.isFile()) continue

      // Bound read size to 10MB per file
      if (stat.size > 10 * 1024 * 1024) continue

      const content = fs.readFileSync(resolved, 'utf8')
      const relPath = path.relative(baseDir, resolved).replace(/\\/g, '/')
      const chunks = chunkDocument(relPath, content, chunkSizeChars)
      allChunks.push(...chunks)
    } catch {
      // Ignore unreadable files
    }
  }

  return allChunks
}
