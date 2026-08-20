/**
 * Context injector: automatically discovers and injects Knowledge Graph summaries
 * and Work Memory Lessons into system prompts on session boot.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/context-injector
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

/**
 * Apply auto context injection for Graphify reports and lessons.
 */
export function applyGraphifyContextInjector(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'graphify:knowledge_context',
    order: 45,
    text() {
      const root = resolve(process.cwd())
      const reportPath = join(root, 'graphify-out', 'GRAPH_REPORT.md')
      const lessonsPath = join(root, 'LESSONS.md')

      let reportText = ''
      let lessonsText = ''

      try {
        const rawReport = readFileSync(reportPath, 'utf-8')
        // Truncate report to essential summary if very large
        reportText = rawReport.slice(0, 3000)
      } catch {
        // No report yet
      }

      try {
        const rawLessons = readFileSync(lessonsPath, 'utf-8')
        lessonsText = rawLessons.slice(0, 2000)
      } catch {
        // No lessons yet
      }

      if (!reportText && !lessonsText) {
        return ''
      }

      const parts: string[] = ['## Codebase Architecture & Work Memory Context']
      if (reportText) {
        parts.push('### Architecture Knowledge Graph Snapshot', reportText)
      }
      if (lessonsText) {
        parts.push('### Historical Lessons & Preferred Sources (LESSONS.md)', lessonsText)
      }

      return parts.join('\n\n')
    },
  })
}
