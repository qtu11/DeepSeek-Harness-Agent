/**
 * Deterministic Work Memory reflection and lesson aggregation engine.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/reflect
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { loadAllMemories } from './memory.ts'
import type { CodebaseGraph, LessonItem, OutcomeType, ReflectionReport } from './types.ts'

export interface ReflectOptions {
  rootDir: string
  memoryDir?: string | undefined
  halfLifeDays?: number | undefined
  minCorroboration?: number | undefined
  graph?: CodebaseGraph | undefined
}

const DEFAULT_HALF_LIFE_DAYS = 30.0
const DEFAULT_MIN_CORROBORATION = 2

/**
 * Run deterministic reflection over memory records and generate LESSONS.md.
 */
export async function reflectWorkMemory(options: ReflectOptions): Promise<ReflectionReport> {
  const root = resolve(options.rootDir)
  const memories = await loadAllMemories(root, options.memoryDir)
  const halfLifeDays = options.halfLifeDays || DEFAULT_HALF_LIFE_DAYS
  const minCorroboration = options.minCorroboration || DEFAULT_MIN_CORROBORATION

  const now = new Date()
  const nodeStats = new Map<
    string,
    {
      label: string
      score: number
      positiveCount: number
      negativeCount: number
      latestOutcome: OutcomeType
      latestDate: string
      correction?: string | undefined
      notes: string[]
    }
  >()

  const corrections: LessonItem[] = []

  // Aggregate signals per cited node
  for (const mem of memories) {
    const memDate = new Date(mem.created_at)
    const ageDays = Math.max(0, (now.getTime() - memDate.getTime()) / (1000 * 60 * 60 * 24))
    const decay = Math.pow(2, -ageDays / halfLifeDays)

    let weight = 0
    if (mem.outcome === 'useful') weight = 1.0 * decay
    else if (mem.outcome === 'dead_end') weight = -1.5 * decay
    else if (mem.outcome === 'corrected') weight = -1.0 * decay

    for (const node of mem.source_nodes) {
      let stat = nodeStats.get(node)
      if (!stat) {
        stat = {
          label: node,
          score: 0,
          positiveCount: 0,
          negativeCount: 0,
          latestOutcome: mem.outcome,
          latestDate: mem.created_at,
          correction: mem.correction,
          notes: [],
        }
        nodeStats.set(node, stat)
      }

      stat.score += weight
      if (mem.outcome === 'useful') {
        stat.positiveCount++
      } else {
        stat.negativeCount++
      }

      if (new Date(mem.created_at) >= new Date(stat.latestDate)) {
        stat.latestOutcome = mem.outcome
        stat.latestDate = mem.created_at
        if (mem.correction) stat.correction = mem.correction
      }

      stat.notes.push(`[${mem.outcome}] ${mem.question}`)
    }

    if (mem.outcome === 'corrected' && mem.correction) {
      corrections.push({
        node_id: mem.source_nodes[0] || 'general',
        label: mem.question,
        status: 'corrected',
        score: -1,
        corroboration_count: 1,
        positive_count: 0,
        negative_count: 1,
        latest_outcome: 'corrected',
        latest_date: mem.created_at,
        correction: mem.correction,
      })
    }
  }

  const preferred: LessonItem[] = []
  const tentative: LessonItem[] = []
  const contested: LessonItem[] = []
  const deadEnds: LessonItem[] = []

  for (const [nodeId, stat] of nodeStats.entries()) {
    const totalCount = stat.positiveCount + stat.negativeCount
    let status: LessonItem['status'] = 'tentative'

    if (stat.negativeCount > 0 && stat.positiveCount > 0) {
      status = 'contested'
    } else if (stat.negativeCount > 0 && stat.positiveCount === 0) {
      status = 'dead_end'
    } else if (stat.positiveCount >= minCorroboration) {
      status = 'preferred'
    } else {
      status = 'tentative'
    }

    const item: LessonItem = {
      node_id: nodeId,
      label: stat.label,
      status,
      score: Number(stat.score.toFixed(4)),
      corroboration_count: totalCount,
      positive_count: stat.positiveCount,
      negative_count: stat.negativeCount,
      latest_outcome: stat.latestOutcome,
      latest_date: stat.latestDate,
      correction: stat.correction,
      notes: stat.notes.slice(0, 3).join('; '),
    }

    if (status === 'preferred') preferred.push(item)
    else if (status === 'tentative') tentative.push(item)
    else if (status === 'contested') contested.push(item)
    else if (status === 'dead_end') deadEnds.push(item)
  }

  // Sort deterministically
  preferred.sort((a, b) => b.score - a.score || a.node_id.localeCompare(b.node_id))
  tentative.sort((a, b) => b.score - a.score || a.node_id.localeCompare(b.node_id))
  contested.sort((a, b) => b.latest_date.localeCompare(a.latest_date))
  deadEnds.sort((a, b) => a.score - b.score)

  const lessonsMarkdown = formatLessonsMarkdown({
    generated_at: now.toISOString(),
    total_memories: memories.length,
    preferred_sources: preferred,
    tentative_sources: tentative,
    contested_sources: contested,
    known_dead_ends: deadEnds,
    corrections,
    lessons_markdown: '',
  })

  // Write to graphify-out/reflections/LESSONS.md and root LESSONS.md
  const reflectionsDir = join(root, 'graphify-out', 'reflections')
  await mkdir(reflectionsDir, { recursive: true })
  await writeFile(join(reflectionsDir, 'LESSONS.md'), lessonsMarkdown, 'utf-8')
  await writeFile(join(root, 'LESSONS.md'), lessonsMarkdown, 'utf-8')

  return {
    generated_at: now.toISOString(),
    total_memories: memories.length,
    preferred_sources: preferred,
    tentative_sources: tentative,
    contested_sources: contested,
    known_dead_ends: deadEnds,
    corrections,
    lessons_markdown: lessonsMarkdown,
  }
}

/**
 * Format Lessons into clean Markdown.
 */
function formatLessonsMarkdown(report: ReflectionReport): string {
  const lines: string[] = []

  lines.push('# Codebase Work Memory & Technical Lessons (LESSONS.md)')
  lines.push(`*Generated at: ${report.generated_at} | Total Records: ${report.total_memories}*`)
  lines.push('')
  lines.push(
    'Tài liệu này tổng hợp toàn bộ bài học kinh nghiệm, nguồn tra cứu ưu tiên và các ngõ cụt kỹ thuật từ các phiên làm việc trước để các phiên chat mới lập tức kế thừa kiến thức mà không lặp lại sai lầm.',
  )
  lines.push('')

  // 1. Preferred Sources
  lines.push('## 1. Preferred Sources (Nguồn chuẩn đã được xác thực ≥ 2 lần)')
  if (report.preferred_sources.length === 0) {
    lines.push('*Chưa có nguồn nào đạt ngưỡng xác thực preferred.*')
  } else {
    for (const item of report.preferred_sources) {
      lines.push(`- **\`${item.node_id}\`** (Điểm tin cậy: \`${item.score}\`, Xác thực: \`${item.positive_count}\` lần)`)
      if (item.notes) lines.push(`  - *Ngữ cảnh*: ${item.notes}`)
    }
  }
  lines.push('')

  // 2. Known Dead Ends
  lines.push('## 2. Known Dead Ends (Các ngõ cụt kỹ thuật cần tránh)')
  if (report.known_dead_ends.length === 0) {
    lines.push('*Không có ngõ cụt nào được ghi nhận.*')
  } else {
    for (const item of report.known_dead_ends) {
      lines.push(`- ⚠️ **\`${item.node_id}\`** (Điểm phạt: \`${item.score}\`, Báo lỗi: \`${item.negative_count}\` lần)`)
      if (item.notes) lines.push(`  - *Lý do*: ${item.notes}`)
    }
  }
  lines.push('')

  // 3. Corrections
  lines.push('## 3. Corrections (Các điểm đã được đính chính)')
  if (report.corrections.length === 0) {
    lines.push('*Không có đính chính nào.*')
  } else {
    for (const item of report.corrections) {
      lines.push(`- **Vấn đề**: ${item.label}`)
      lines.push(`  - **Đính chính**: \`${item.correction}\``)
    }
  }
  lines.push('')

  // 4. Tentative & Contested
  if (report.contested_sources.length > 0) {
    lines.push('## 4. Contested Signals (Tín hiệu xung đột - Ưu tiên kết quả gần nhất)')
    for (const item of report.contested_sources) {
      lines.push(`- **\`${item.node_id}\`** (+${item.positive_count} / -${item.negative_count}, Gần nhất: \`${item.latest_outcome}\`)`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('*Tự động quản lý bởi DeepSeek Harness Graphify Reflection Engine*')
  return lines.join('\n')
}
