/**
 * Model-facing Graphify tools: graphify_scan, graphify_query, graphify_save_result, graphify_reflect.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/tools
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import { scanCodebase } from './scanner.ts'
import {
  buildCodebaseGraph,
  generateGraphReportMarkdown,
  queryNeighborhood,
  queryShortestPath,
} from './graph.ts'
import { saveMemoryResult } from './memory.ts'
import { reflectWorkMemory } from './reflect.ts'
import type { CodebaseGraph, OutcomeType } from './types.ts'

export interface GraphifyScanResultValue {
  message: string
  total_files: number
  total_nodes: number
  total_edges: number
  communities: number
  god_nodes: string[]
  report_path: string
}

export interface GraphifyQueryResultValue {
  output: string
}

export interface GraphifySaveResultValue {
  saved_path: string
  message: string
}

export interface GraphifyReflectResultValue {
  total_memories: number
  preferred_sources: number
  dead_ends: number
  corrections: number
  message: string
}

/** Register all Graphify tools into Cordis context. */
export function applyGraphifyTools(ctx: Context): void {
  // System prompt explanation
  ctx.systemPrompt.section({
    name: 'tool:graphify',
    order: 104,
    text: [
      '## Codebase Knowledge Graph & Work Memory (Graphify Engine)',
      '1. Use `graphify_scan` to map the whole codebase into a Knowledge Graph (nodes, edges, communities, God nodes) and generate `GRAPH_REPORT.md`.',
      '2. Use `graphify_query` to traverse dependencies, caller/callee relationships, and architecture paths without grepping or reading raw files.',
      '3. Use `graphify_save_result` to record verified Q&A findings and outcome signals (useful/dead_end/corrected) to work memory.',
      '4. Use `graphify_reflect` to aggregate lessons into `LESSONS.md` with time-decay scoring.',
    ].join('\n'),
  })

  // 1. graphify_scan
  ctx.tools.register(
    defineTool({
      name: 'graphify_scan',
      description: 'Scan workspace codebase using AST structural extraction, build directed Knowledge Graph (nodes, edges, communities, God nodes) and generate GRAPH_REPORT.md.',
      parameters: {
        target_dir: {
          type: 'string',
          description: 'Target directory to scan (defaults to workspace root).',
        },
        rebuild: {
          type: 'boolean',
          description: 'Force full rebuild of graph.json and GRAPH_REPORT.md.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            message: { type: 'string', required: true },
            total_files: { type: 'integer', required: true },
            total_nodes: { type: 'integer', required: true },
            total_edges: { type: 'integer', required: true },
            communities: { type: 'integer', required: true },
            god_nodes: { type: 'array', items: { type: 'string' }, required: true },
            report_path: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      presentCall: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Scan: ${String(args.target_dir ?? '.')}`,
        rawInput: String(args.target_dir ?? '.'),
      }),
      presentResult: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Scan: ${String(args.target_dir ?? '.')}`,
        rawInput: String(args.target_dir ?? '.'),
      }),
      execute: async (args): Promise<GraphifyScanResultValue> => {
        const targetDir = (args.target_dir as string) || process.cwd()
        const root = resolve(targetDir)
        const scanRes = await scanCodebase(root)
        const graph = buildCodebaseGraph(root, scanRes.nodes, scanRes.edges, scanRes.languageCounts)

        const outDir = join(root, 'graphify-out')
        await mkdir(outDir, { recursive: true })
        await writeFile(join(outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf-8')

        const reportMd = generateGraphReportMarkdown(graph)
        const reportPath = join(outDir, 'GRAPH_REPORT.md')
        await writeFile(reportPath, reportMd, 'utf-8')

        const msg = [
          'Codebase Knowledge Graph successfully built at `graphify-out/graph.json`!',
          `- **Total Files**: ${graph.summary.total_files}`,
          `- **Total Nodes**: ${graph.summary.total_nodes} (functions, classes, interfaces, endpoints, schemas)`,
          `- **Total Edges**: ${graph.summary.total_edges} (calls, imports, defines, inherits)`,
          `- **Communities**: ${graph.summary.communities_count}`,
          `- **God Nodes (Key Hubs)**: ${graph.god_nodes.slice(0, 5).join(', ') || 'none'}`,
          `- **Circular Dependencies**: ${graph.circular_dependencies.length}`,
          '',
          'Architecture report saved to `graphify-out/GRAPH_REPORT.md`.',
        ].join('\n')

        return {
          message: msg,
          total_files: graph.summary.total_files,
          total_nodes: graph.summary.total_nodes,
          total_edges: graph.summary.total_edges,
          communities: graph.summary.communities_count,
          god_nodes: graph.god_nodes,
          report_path: reportPath,
        }
      },
    }),
  )

  // 2. graphify_query
  ctx.tools.register(
    defineTool({
      name: 'graphify_query',
      description: 'Query the codebase Knowledge Graph to inspect neighbors, callers, callees, dependency paths, or God nodes without reading raw files.',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Symbol name, file path, or component identifier to query.',
        },
        mode: {
          type: 'string',
          description: 'Query mode: "neighborhood" (default), "path", "god_nodes", "cycles", or "summary".',
        },
        start_node: {
          type: 'string',
          description: 'Start node for path queries.',
        },
        end_node: {
          type: 'string',
          description: 'End node for path queries.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            output: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.output }],
      },
      presentCall: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Query: ${String(args.query ?? '')}`,
        rawInput: String(args.query ?? ''),
      }),
      presentResult: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Query: ${String(args.query ?? '')}`,
        rawInput: String(args.query ?? ''),
      }),
      execute: async (args): Promise<GraphifyQueryResultValue> => {
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

        const mode = (args.mode as string) || 'neighborhood'
        const query = String(args.query ?? '')

        if (mode === 'path' && args.start_node && args.end_node) {
          const path = queryShortestPath(graph, String(args.start_node), String(args.end_node))
          if (!path) {
            return { output: `No dependency path found between \`${args.start_node}\` and \`${args.end_node}\`.` }
          }
          return { output: 'Shortest Dependency Path:\n' + path.map((n, i) => `${i + 1}. \`${n}\``).join(' → ') }
        }

        if (mode === 'god_nodes') {
          return {
            output: 'Core God Nodes (Top Architectural Hubs):\n' +
              graph.god_nodes.map(g => `- \`${g}\``).join('\n'),
          }
        }

        if (mode === 'cycles') {
          if (graph.circular_dependencies.length === 0) {
            return { output: 'No circular dependencies detected in the codebase graph.' }
          }
          return {
            output: 'Detected Circular Dependencies:\n' +
              graph.circular_dependencies.map(c => `- ${c.join(' → ')}`).join('\n'),
          }
        }

        const res = queryNeighborhood(graph, query)
        if (!res.targetNode) {
          return { output: `Symbol or file matching \`${query}\` was not found in the Knowledge Graph.` }
        }

        const lines: string[] = [
          `# Graph Element: \`${res.targetNode.id}\``,
          `- **Kind**: \`${res.targetNode.kind}\``,
          `- **File**: \`${res.targetNode.source_file}\` (${res.targetNode.source_location || 'L1'})`,
          `- **Community**: \`${res.targetNode.community || 'root'}\``,
          '',
          `### Incoming References / Callers (${res.incoming.length})`,
        ]

        for (const inc of res.incoming.slice(0, 10)) {
          lines.push(`- ← \`${inc.source?.id || 'unknown'}\` (\`${inc.relation}\`)`)
        }
        if (res.incoming.length === 0) lines.push('- *(None)*')

        lines.push('', `### Outgoing Dependencies / Calls (${res.outgoing.length})`)
        for (const out of res.outgoing.slice(0, 10)) {
          lines.push(`- → \`${out.target?.id || 'unknown'}\` (\`${out.relation}\`)`)
        }
        if (res.outgoing.length === 0) lines.push('- *(None)*')

        if (res.siblings.length > 0) {
          lines.push('', '### Sibling Module Components')
          for (const sib of res.siblings.slice(0, 6)) {
            lines.push(`- \`${sib.id}\` [${sib.kind}]`)
          }
        }

        return { output: lines.join('\n') }
      },
    }),
  )

  // 3. graphify_save_result
  ctx.tools.register(
    defineTool({
      name: 'graphify_save_result',
      description: 'Record an execution or Q&A outcome (useful/dead_end/corrected) with cited nodes to graphify-out/memory/ to train the work memory.',
      parameters: {
        question: {
          type: 'string',
          required: true,
          description: 'The task, problem, or architectural question.',
        },
        answer: {
          type: 'string',
          required: true,
          description: 'The verified answer or technical conclusion.',
        },
        nodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key nodes, symbols, or files cited in this result.',
        },
        outcome: {
          type: 'string',
          description: 'Outcome signal: "useful" (default), "dead_end", or "corrected".',
        },
        correction: {
          type: 'string',
          description: 'If outcome is corrected, provide the correct explanation/fix.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            saved_path: { type: 'string', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      presentCall: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Save: ${String(args.question ?? '')}`,
        rawInput: String(args.question ?? ''),
      }),
      presentResult: (args): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: `Graphify Save: ${String(args.question ?? '')}`,
        rawInput: String(args.question ?? ''),
      }),
      execute: async (args): Promise<GraphifySaveResultValue> => {
        const root = resolve(process.cwd())
        const savedPath = await saveMemoryResult({
          rootDir: root,
          question: String(args.question ?? ''),
          answer: String(args.answer ?? ''),
          sourceNodes: (args.nodes as string[]) || [],
          outcome: (args.outcome as OutcomeType) || 'useful',
          correction: args.correction ? String(args.correction) : undefined,
        })

        await reflectWorkMemory({ rootDir: root })

        return {
          saved_path: savedPath,
          message: `Work Memory outcome recorded to \`${savedPath}\` and \`LESSONS.md\` updated!`,
        }
      },
    }),
  )

  // 4. graphify_reflect
  ctx.tools.register(
    defineTool({
      name: 'graphify_reflect',
      description: 'Run deterministic work-memory reflection over all saved outcomes, recalculate node weights, and compile graphify-out/reflections/LESSONS.md.',
      parameters: {
        min_corroboration: {
          type: 'number',
          description: 'Minimum distinct positive outcomes needed to promote a node to "preferred" (default: 2).',
        },
        half_life_days: {
          type: 'number',
          description: 'Half-life in days for time-decay scoring (default: 30.0).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            total_memories: { type: 'integer', required: true },
            preferred_sources: { type: 'integer', required: true },
            dead_ends: { type: 'integer', required: true },
            corrections: { type: 'integer', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      presentCall: (): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: 'Graphify Reflection',
        rawInput: 'reflectWorkMemory',
      }),
      presentResult: (): GenericCallView => ({
        card: 'generic',
        kind: 'search',
        title: 'Graphify Reflection',
        rawInput: 'reflectWorkMemory',
      }),
      execute: async (args): Promise<GraphifyReflectResultValue> => {
        const root = resolve(process.cwd())
        const report = await reflectWorkMemory({
          rootDir: root,
          minCorroboration: typeof args.min_corroboration === 'number' ? args.min_corroboration : undefined,
          halfLifeDays: typeof args.half_life_days === 'number' ? args.half_life_days : undefined,
        })

        const msg = [
          'Deterministic Reflection Completed!',
          `- **Total Memories Analyzed**: ${report.total_memories}`,
          `- **Preferred Sources (Corroborated ≥ 2)**: ${report.preferred_sources.length}`,
          `- **Known Dead Ends**: ${report.known_dead_ends.length}`,
          `- **Corrections**: ${report.corrections.length}`,
          '- **Updated**: `graphify-out/reflections/LESSONS.md` and `LESSONS.md`.',
        ].join('\n')

        return {
          total_memories: report.total_memories,
          preferred_sources: report.preferred_sources.length,
          dead_ends: report.known_dead_ends.length,
          corrections: report.corrections.length,
          message: msg,
        }
      },
    }),
  )
}
