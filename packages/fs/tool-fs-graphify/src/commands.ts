/**
 * Human slash commands for Graphify Knowledge Graph & Work Memory.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/commands
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { scanCodebase } from './scanner.ts'
import {
  buildCodebaseGraph,
  generateGraphReportMarkdown,
  queryNeighborhood,
  queryShortestPath,
} from './graph.ts'
import { reflectWorkMemory } from './reflect.ts'
import type { CodebaseGraph } from './types.ts'

/**
 * Register slash commands `/graphify_scan`, `/graphify_query`, `/graphify_reflect`.
 */
export function applyGraphifyCommands(ctx: Context): void {
  // Only register if commands service is present in context
  const commands = ctx.get('commands')
  if (!commands) return

  // 1. /graphify_scan
  ctx.commands.register({
    name: 'graphify_scan',
    description: 'Scan codebase AST, build Knowledge Graph and generate GRAPH_REPORT.md',
    handler: async (_invocation: CommandInvocation): Promise<CommandResult> => {
      try {
        const root = resolve(process.cwd())
        const scanRes = await scanCodebase(root)
        const graph = buildCodebaseGraph(root, scanRes.nodes, scanRes.edges, scanRes.languageCounts)

        const outDir = join(root, 'graphify-out')
        await mkdir(outDir, { recursive: true })
        await writeFile(join(outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf-8')

        const reportMd = generateGraphReportMarkdown(graph)
        const reportPath = join(outDir, 'GRAPH_REPORT.md')
        await writeFile(reportPath, reportMd, 'utf-8')

        const text = [
          '# Đã lập xong Đồ Thị Tri Thức Codebase (Knowledge Graph)',
          `- **Tổng số tệp quét được**: ${graph.summary.total_files}`,
          `- **Tổng số nodes (AST)**: ${graph.summary.total_nodes}`,
          `- **Tổng số liên kết (Edges)**: ${graph.summary.total_edges}`,
          `- **Phân cụm cộng đồng**: ${graph.summary.communities_count}`,
          `- **Top God Nodes**: ${graph.god_nodes.slice(0, 5).join(', ') || 'none'}`,
          '- **Báo cáo kiến trúc chi tiết**: `graphify-out/GRAPH_REPORT.md`',
        ].join('\n')

        return { kind: 'success', text }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        return { kind: 'error', text: `Lỗi khi quét đồ thị tri thức: ${errMsg}` }
      }
    },
  })

  // 2. /graphify_query
  ctx.commands.register({
    name: 'graphify_query',
    description: 'Query the codebase Knowledge Graph for symbol dependencies and God nodes',
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      try {
        const query = invocation.rawInput.trim()
        if (!query) {
          return { kind: 'error', text: 'Cú pháp: /graphify_query <tên hàm/class/file>' }
        }

        const root = resolve(process.cwd())
        const graphPath = join(root, 'graphify-out', 'graph.json')

        let graph: CodebaseGraph
        try {
          const content = await readFile(graphPath, 'utf-8')
          graph = JSON.parse(content) as CodebaseGraph
        } catch {
          const scanRes = await scanCodebase(root)
          graph = buildCodebaseGraph(root, scanRes.nodes, scanRes.edges, scanRes.languageCounts)
        }

        if (query === 'god_nodes') {
          return {
            kind: 'success',
            text: 'Core God Nodes:\n' + graph.god_nodes.map(g => `- \`${g}\``).join('\n'),
          }
        }

        if (query.includes('->')) {
          const parts = query.split('->').map(s => s.trim())
          if (parts[0] && parts[1]) {
            const path = queryShortestPath(graph, parts[0], parts[1])
            if (!path) return { kind: 'success', text: `Không tìm thấy đường dẫn phụ thuộc giữa \`${parts[0]}\` và \`${parts[1]}\`.` }
            return { kind: 'success', text: 'Đường dẫn phụ thuộc:\n' + path.map((n, i) => `${i + 1}. \`${n}\``).join(' → ') }
          }
        }

        const res = queryNeighborhood(graph, query)
        if (!res.targetNode) {
          return { kind: 'error', text: `Không tìm thấy phần tử nào khớp với \`${query}\` trong Knowledge Graph.` }
        }

        const lines: string[] = [
          `# Graph Element: \`${res.targetNode.id}\``,
          `- **Loại**: \`${res.targetNode.kind}\``,
          `- **Tệp**: \`${res.targetNode.source_file}\` (${res.targetNode.source_location || 'L1'})`,
          `- **Phân hệ**: \`${res.targetNode.community || 'root'}\``,
          '',
          `### Gọi tới phần tử này (${res.incoming.length})`,
        ]

        for (const inc of res.incoming.slice(0, 10)) {
          lines.push(`- ← \`${inc.source?.id || 'unknown'}\` (\`${inc.relation}\`)`)
        }
        if (res.incoming.length === 0) lines.push('- *(Không có)*')

        lines.push('', `### Phụ thuộc được gọi đi (${res.outgoing.length})`)
        for (const out of res.outgoing.slice(0, 10)) {
          lines.push(`- → \`${out.target?.id || 'unknown'}\` (\`${out.relation}\`)`)
        }
        if (res.outgoing.length === 0) lines.push('- *(Không có)*')

        return { kind: 'success', text: lines.join('\n') }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        return { kind: 'error', text: `Lỗi khi truy vấn: ${errMsg}` }
      }
    },
  })

  // 3. /graphify_reflect
  ctx.commands.register({
    name: 'graphify_reflect',
    description: 'Reflect over all work memories and aggregate lessons into LESSONS.md',
    handler: async (_invocation: CommandInvocation): Promise<CommandResult> => {
      try {
        const root = resolve(process.cwd())
        const report = await reflectWorkMemory({ rootDir: root })

        const text = [
          '# Hoàn Tất Phản Tư Bài Học (Reflection)',
          `- **Tổng số bản ghi bộ nhớ**: ${report.total_memories}`,
          `- **Nguồn tin cậy chuẩn (Preferred)**: ${report.preferred_sources.length}`,
          `- **Ngõ cụt cần tránh (Dead ends)**: ${report.known_dead_ends.length}`,
          `- **Đính chính (Corrections)**: ${report.corrections.length}`,
          '- **Đã cập nhật**: `LESSONS.md`',
        ].join('\n')

        return { kind: 'success', text }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        return { kind: 'error', text: `Lỗi khi phản tư: ${errMsg}` }
      }
    },
  })
}
