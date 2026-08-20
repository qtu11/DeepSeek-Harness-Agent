import { describe, expect, it } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import Tools from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as GraphifyPlugin from '../src/index.ts'
import { scanCodebase } from '../src/scanner.ts'
import {
  buildCodebaseGraph,
  generateGraphReportMarkdown,
  queryNeighborhood,
} from '../src/graph.ts'
import { saveMemoryResult, loadAllMemories } from '../src/memory.ts'
import { reflectWorkMemory } from '../src/reflect.ts'

describe('Graphify Engine & Work Memory', () => {
  it('scans codebase and extracts AST nodes and edges across languages', async () => {
    const testDir = join(tmpdir(), `dsh-graphify-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      // 1. Create TS file
      const tsContent = `
import { Helper } from './helper.ts'

export interface UserModel {
  id: string
  name: string
}

export class UserService {
  getUser(): UserModel {
    return Helper.fetch()
  }
}

export async function authenticate(): Promise<boolean> {
  return true
}
`
      await writeFile(join(testDir, 'user.ts'), tsContent, 'utf-8')

      // 2. Create Python file
      const pyContent = `
from math import sqrt

class DatabaseManager:
    def connect(self):
        pass

def process_data():
    pass
`
      await writeFile(join(testDir, 'db.py'), pyContent, 'utf-8')

      // 3. Scan codebase
      const scanResult = await scanCodebase(testDir)
      expect(scanResult.nodes.length).toBeGreaterThan(0)
      expect(scanResult.edges.length).toBeGreaterThan(0)

      // Verify node types
      const classNodes = scanResult.nodes.filter(n => n.kind === 'class')
      const ifNodes = scanResult.nodes.filter(n => n.kind === 'interface')
      const funcNodes = scanResult.nodes.filter(n => n.kind === 'function')

      expect(classNodes.some(n => n.label === 'UserService')).toBe(true)
      expect(classNodes.some(n => n.label === 'DatabaseManager')).toBe(true)
      expect(ifNodes.some(n => n.label === 'UserModel')).toBe(true)
      expect(funcNodes.some(n => n.label === 'authenticate')).toBe(true)
      expect(funcNodes.some(n => n.label === 'process_data')).toBe(true)

      // 4. Build graph & topological analysis
      const graph = buildCodebaseGraph(testDir, scanResult.nodes, scanResult.edges, scanResult.languageCounts)
      expect(graph.summary.total_files).toBe(2)
      expect(graph.summary.total_nodes).toBe(scanResult.nodes.length)
      expect(graph.summary.communities_count).toBeGreaterThan(0)

      // 5. Generate Markdown report
      const report = generateGraphReportMarkdown(graph)
      expect(report).toContain('Codebase Architecture Knowledge Graph Report')
      expect(report).toContain('DatabaseManager')

      // 6. Query neighborhood
      const queryRes = queryNeighborhood(graph, 'UserService')
      expect(queryRes.targetNode).toBeDefined()
      expect(queryRes.targetNode?.label).toBe('UserService')

      // 7. Test Work Memory: save-result and reflection
      await saveMemoryResult({
        rootDir: testDir,
        question: 'How to authenticate user?',
        answer: 'Call authenticate function in user.ts',
        sourceNodes: ['function:user.ts:authenticate'],
        outcome: 'useful',
      })

      await saveMemoryResult({
        rootDir: testDir,
        question: 'Can we call process_data directly without DB?',
        answer: 'No, calling it directly leads to error',
        sourceNodes: ['function:db.py:process_data'],
        outcome: 'dead_end',
      })

      const memories = await loadAllMemories(testDir)
      expect(memories.length).toBe(2)

      const reflection = await reflectWorkMemory({ rootDir: testDir, minCorroboration: 1 })
      expect(reflection.total_memories).toBe(2)
      expect(reflection.preferred_sources.length).toBe(1)
      expect(reflection.preferred_sources[0]!.node_id).toBe('function:user.ts:authenticate')
      expect(reflection.known_dead_ends.length).toBe(1)
      expect(reflection.known_dead_ends[0]!.node_id).toBe('function:db.py:process_data')
      expect(reflection.lessons_markdown).toContain('Preferred Sources')
      expect(reflection.lessons_markdown).toContain('Known Dead Ends')

      const lessonsFile = await readFile(join(testDir, 'LESSONS.md'), 'utf-8')
      expect(lessonsFile).toContain('LESSONS.md')
    } finally {
      await rm(testDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('registers Graphify tools and context injector into Cordis context', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(Tools)
    const fiber = await ctx.plugin(GraphifyPlugin, { tools: true, autoContext: true })

    const toolNames = ctx.tools.schemas().map(s => s.name)

    expect(toolNames).toContain('graphify_scan')
    expect(toolNames).toContain('graphify_query')
    expect(toolNames).toContain('graphify_save_result')
    expect(toolNames).toContain('graphify_reflect')

    await fiber.dispose()
  })
})
