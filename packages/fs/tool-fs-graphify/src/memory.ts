/**
 * Work Memory storage and management for Graphify.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/memory
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { MemoryEntry, OutcomeType } from './types.ts'

export interface SaveMemoryOptions {
  rootDir: string
  question: string
  answer: string
  type?: string | undefined
  sourceNodes?: string[] | undefined
  outcome?: OutcomeType | undefined
  correction?: string | undefined
  memoryDir?: string | undefined
}

/**
 * Format a string to safe slug filename.
 */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'memory-entry'
}

/**
 * Save a Q&A outcome result to graphify-out/memory/.
 */
export async function saveMemoryResult(options: SaveMemoryOptions): Promise<string> {
  const root = resolve(options.rootDir)
  const targetDir = options.memoryDir ? resolve(root, options.memoryDir) : join(root, 'graphify-out', 'memory')
  await mkdir(targetDir, { recursive: true })

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const id = `${dateStr}-${toSlug(options.question)}`
  const filePath = join(targetDir, `${id}.md`)

  const nodesJson = JSON.stringify(options.sourceNodes || [])
  const outcome = options.outcome || 'useful'
  const type = options.type || 'query'

  const content = [
    '---',
    `id: "${id}"`,
    `type: "${type}"`,
    `question: "${options.question.replace(/"/g, '\\"')}"`,
    `source_nodes: ${nodesJson}`,
    `outcome: "${outcome}"`,
    options.correction ? `correction: "${options.correction.replace(/"/g, '\\"')}"` : '',
    `created_at: "${now.toISOString()}"`,
    '---',
    '',
    `# Q&A Result: ${options.question}`,
    '',
    '## Answer',
    options.answer,
    '',
    '## Outcome',
    `- **Status**: \`${outcome}\``,
    options.correction ? `- **Correction**: ${options.correction}` : '',
    options.sourceNodes && options.sourceNodes.length > 0
      ? `- **Cited Nodes**: ${options.sourceNodes.map(n => `\`${n}\``).join(', ')}`
      : '',
    '',
  ]
    .filter(line => line !== '')
    .join('\n')

  await writeFile(filePath, content, 'utf-8')
  return filePath
}

/**
 * Load all memory entries from graphify-out/memory/.
 */
export async function loadAllMemories(rootDir: string, memoryDir?: string): Promise<MemoryEntry[]> {
  const root = resolve(rootDir)
  const targetDir = memoryDir ? resolve(root, memoryDir) : join(root, 'graphify-out', 'memory')

  let fileNames: string[] = []
  try {
    fileNames = await readdir(targetDir)
  } catch {
    return []
  }

  const entries: MemoryEntry[] = []

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.md')) continue
    const fullPath = join(targetDir, fileName)
    try {
      const content = await readFile(fullPath, 'utf-8')
      const parsed = parseMemoryMarkdown(content)
      if (parsed) {
        entries.push(parsed)
      }
    } catch {
      continue
    }
  }

  return entries
}

/**
 * Parse Markdown with frontmatter into MemoryEntry.
 */
function parseMemoryMarkdown(content: string): MemoryEntry | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  const frontmatter = match[1] ?? ''
  const body = match[2] ?? ''

  const idMatch = frontmatter.match(/id:\s*"([^"]+)"/)
  const typeMatch = frontmatter.match(/type:\s*"([^"]+)"/)
  const qMatch = frontmatter.match(/question:\s*"([^"]+)"/)
  const outcomeMatch = frontmatter.match(/outcome:\s*"([^"]+)"/)
  const nodesMatch = frontmatter.match(/source_nodes:\s*\[(.*?)\]/)
  const corrMatch = frontmatter.match(/correction:\s*"([^"]+)"/)
  const dateMatch = frontmatter.match(/created_at:\s*"([^"]+)"/)

  let sourceNodes: string[] = []
  if (nodesMatch && nodesMatch[1]) {
    try {
      sourceNodes = JSON.parse(`[${nodesMatch[1]}]`)
    } catch {
      sourceNodes = nodesMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
    }
  }

  const id = idMatch && idMatch[1] ? idMatch[1] : 'unknown'
  const type = typeMatch && typeMatch[1] ? typeMatch[1] : 'query'
  const question = qMatch && qMatch[1] ? qMatch[1] : 'Unknown Question'
  const outcome = (outcomeMatch && outcomeMatch[1] ? outcomeMatch[1] : 'useful') as OutcomeType
  const correction = corrMatch && corrMatch[1] ? corrMatch[1] : undefined
  const createdAt = dateMatch && dateMatch[1] ? dateMatch[1] : new Date().toISOString()

  return {
    id,
    type,
    question,
    answer: body.trim(),
    source_nodes: sourceNodes,
    outcome,
    correction,
    created_at: createdAt,
  }
}
