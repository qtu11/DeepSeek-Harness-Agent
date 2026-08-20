/**
 * Deterministic multi-language AST structural extractor for Code Knowledge Graphs.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/scanner
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve, extname, basename, dirname } from 'node:path'
import type { GraphEdge, GraphNode } from './types.ts'

export interface ScanResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  scannedFiles: string[]
  languageCounts: Record<string, number>
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'dist-app',
  'dist-release',
  'build',
  'out',
  'lib',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  'venv',
  '.venv',
  'env',
  '.gemini',
  '.agents',
  'graphify-out',
])

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.sql': 'sql',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.prisma': 'prisma',
}

/**
 * Collect all relevant source files from root directory.
 */
export async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(currentDir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS[ext]) {
          results.push(fullPath)
        }
      }
    }
  }

  await walk(resolve(rootDir))
  return results
}

/**
 * Clean path string to posix relative path.
 */
function normalizeRelativePath(rootDir: string, fullPath: string): string {
  const rel = relative(rootDir, fullPath)
  return rel.replace(/\\/g, '/')
}

/**
 * Extract structural nodes and edges from collected files.
 */
export async function scanCodebase(rootDir: string, filePaths?: string[]): Promise<ScanResult> {
  const root = resolve(rootDir)
  const files = filePaths && filePaths.length > 0 ? filePaths : await collectSourceFiles(root)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const languageCounts: Record<string, number> = {}
  const symbolMap = new Map<string, string>() // symbol name -> node id

  for (const filePath of files) {
    const relPath = normalizeRelativePath(root, filePath)
    const ext = extname(filePath).toLowerCase()
    const lang = SUPPORTED_EXTENSIONS[ext] || 'unknown'
    languageCounts[lang] = (languageCounts[lang] || 0) + 1

    let content = ''
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      continue
    }

    // 1. Create File Node
    const fileNodeId = `file:${relPath}`
    const fileNode: GraphNode = {
      id: fileNodeId,
      label: basename(relPath),
      kind: 'file',
      source_file: relPath,
      source_location: 'L1',
      description: `${lang} source file`,
    }
    nodes.push(fileNode)

    // 2. Parse language specifics
    if (lang === 'typescript' || lang === 'javascript') {
      extractJsTs(content, relPath, fileNodeId, nodes, edges, symbolMap)
    } else if (lang === 'python') {
      extractPython(content, relPath, fileNodeId, nodes, edges, symbolMap)
    } else if (lang === 'go') {
      extractGo(content, relPath, fileNodeId, nodes, edges, symbolMap)
    } else if (lang === 'rust') {
      extractRust(content, relPath, fileNodeId, nodes, edges, symbolMap)
    } else if (lang === 'sql') {
      extractSql(content, relPath, fileNodeId, nodes, edges, symbolMap)
    } else if (lang === 'json' || lang === 'yaml') {
      extractConfig(relPath, fileNodeId, nodes, edges)
    }
  }

  // 3. Second pass: link symbol references using symbolMap
  linkSymbolReferences(edges, symbolMap)

  return {
    nodes,
    edges,
    scannedFiles: files.map(f => normalizeRelativePath(root, f)),
    languageCounts,
  }
}

/**
 * JS/TS structural extraction.
 */
function extractJsTs(
  content: string,
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  const lines = content.split('\n')

  // Imports
  const importRegex = /import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const importTarget = match[1]
    if (importTarget) {
      edges.push({
        source: fileNodeId,
        target: importTarget.startsWith('.') ? resolveRelativeImport(relPath, importTarget) : `pkg:${importTarget}`,
        relation: 'imports',
        confidence: 'EXTRACTED',
      })
    }
  }

  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$]+))?/

  // Classes & Interfaces
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNum = `L${i + 1}`

    // Classes
    const classMatch = line.match(classRegex)
    if (classMatch && classMatch[1]) {
      const className = classMatch[1]
      const classId = `class:${relPath}:${className}`
      nodes.push({
        id: classId,
        label: className,
        kind: 'class',
        source_file: relPath,
        source_location: lineNum,
        exported: line.includes('export'),
      })
      edges.push({ source: fileNodeId, target: classId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(className, classId)

      if (classMatch[2]) {
        edges.push({
          source: classId,
          target: `class:${classMatch[2]}`,
          relation: 'inherits',
          confidence: 'INFERRED',
        })
      }
    }

    // Interfaces & Types
    const interfaceMatch = line.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/)
    if (interfaceMatch && interfaceMatch[1]) {
      const interfaceName = interfaceMatch[1]
      const ifId = `interface:${relPath}:${interfaceName}`
      nodes.push({
        id: ifId,
        label: interfaceName,
        kind: 'interface',
        source_file: relPath,
        source_location: lineNum,
        exported: line.includes('export'),
      })
      edges.push({ source: fileNodeId, target: ifId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(interfaceName, ifId)
    }

    // Functions
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/) ||
      line.match(/(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/)
    if (funcMatch && funcMatch[1]) {
      const funcName = funcMatch[1]
      const funcId = `function:${relPath}:${funcName}`
      nodes.push({
        id: funcId,
        label: funcName,
        kind: 'function',
        source_file: relPath,
        source_location: lineNum,
        exported: line.includes('export'),
      })
      edges.push({ source: fileNodeId, target: funcId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(funcName, funcId)
    }

    // API Routes (Express / Fastify / Next.js)
    const routeMatch = line.match(/(?:app|router|server)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/)
    if (routeMatch && routeMatch[1] && routeMatch[2]) {
      const method = routeMatch[1].toUpperCase()
      const routePath = routeMatch[2]
      const endpointId = `endpoint:${method}:${routePath}`
      nodes.push({
        id: endpointId,
        label: `${method} ${routePath}`,
        kind: 'endpoint',
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: endpointId, relation: 'defines', confidence: 'EXTRACTED' })
    }
  }
}

/**
 * Python structural extraction.
 */
function extractPython(
  content: string,
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNum = `L${i + 1}`

    // Imports
    const importMatch = line.match(/^(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/)
    if (importMatch) {
      const pkg = importMatch[1] || importMatch[2]
      if (pkg) {
        edges.push({ source: fileNodeId, target: `pkg:${pkg}`, relation: 'imports', confidence: 'EXTRACTED' })
      }
    }

    // Classes
    const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/)
    if (classMatch && classMatch[1]) {
      const className = classMatch[1]
      const classId = `class:${relPath}:${className}`
      nodes.push({
        id: classId,
        label: className,
        kind: 'class',
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: classId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(className, classId)

      if (classMatch[2] && classMatch[2].trim()) {
        const superName = classMatch[2].trim()
        edges.push({ source: classId, target: `class:${superName}`, relation: 'inherits', confidence: 'INFERRED' })
      }
    }

    // Functions
    const funcMatch = line.match(/^def\s+([A-Za-z0-9_]+)\s*\(/)
    if (funcMatch && funcMatch[1]) {
      const funcName = funcMatch[1]
      const funcId = `function:${relPath}:${funcName}`
      nodes.push({
        id: funcId,
        label: funcName,
        kind: 'function',
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: funcId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(funcName, funcId)
    }

    // FastAPI / Flask Endpoints
    const endpointMatch = line.match(/@(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/)
    if (endpointMatch && endpointMatch[2] && endpointMatch[3]) {
      const method = endpointMatch[2].toUpperCase()
      const routePath = endpointMatch[3]
      const endpointId = `endpoint:${method}:${routePath}`
      nodes.push({
        id: endpointId,
        label: `${method} ${routePath}`,
        kind: 'endpoint',
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: endpointId, relation: 'defines', confidence: 'EXTRACTED' })
    }
  }
}

/**
 * Go structural extraction.
 */
function extractGo(
  content: string,
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNum = `L${i + 1}`

    // Structs / Interfaces
    const typeMatch = line.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/)
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const typeName = typeMatch[1]
      const kind = typeMatch[2] === 'interface' ? 'interface' : 'class'
      const typeId = `${kind}:${relPath}:${typeName}`
      nodes.push({
        id: typeId,
        label: typeName,
        kind,
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: typeId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(typeName, typeId)
    }

    // Functions / Methods
    const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/)
    if (funcMatch && funcMatch[1]) {
      const funcName = funcMatch[1]
      const funcId = `function:${relPath}:${funcName}`
      nodes.push({
        id: funcId,
        label: funcName,
        kind: 'function',
        source_file: relPath,
        source_location: lineNum,
      })
      edges.push({ source: fileNodeId, target: funcId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(funcName, funcId)
    }
  }
}

/**
 * Rust structural extraction.
 */
function extractRust(
  content: string,
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNum = `L${i + 1}`

    // Structs & Traits
    const structMatch = line.match(/(?:pub\s+)?(struct|trait|enum)\s+([A-Za-z0-9_]+)/)
    if (structMatch && structMatch[1] && structMatch[2]) {
      const name = structMatch[2]
      const kind = structMatch[1] === 'trait' ? 'interface' : 'class'
      const typeId = `${kind}:${relPath}:${name}`
      nodes.push({ id: typeId, label: name, kind, source_file: relPath, source_location: lineNum })
      edges.push({ source: fileNodeId, target: typeId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(name, typeId)
    }

    // Functions
    const fnMatch = line.match(/(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(/)
    if (fnMatch && fnMatch[1]) {
      const fnName = fnMatch[1]
      const fnId = `function:${relPath}:${fnName}`
      nodes.push({ id: fnId, label: fnName, kind: 'function', source_file: relPath, source_location: lineNum })
      edges.push({ source: fileNodeId, target: fnId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(fnName, fnId)
    }
  }
}

/**
 * SQL extraction.
 */
function extractSql(
  content: string,
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?([a-z0-9_]+)(?:`|")?/gi
  let match: RegExpExecArray | null
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1]
    if (tableName) {
      const tableId = `schema:${relPath}:${tableName}`
      nodes.push({ id: tableId, label: tableName, kind: 'schema', source_file: relPath })
      edges.push({ source: fileNodeId, target: tableId, relation: 'defines', confidence: 'EXTRACTED' })
      symbolMap.set(tableName, tableId)
    }
  }
}

/**
 * Config extraction.
 */
function extractConfig(
  relPath: string,
  fileNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): void {
  const configNodeId = `config:${relPath}`
  nodes.push({
    id: configNodeId,
    label: basename(relPath),
    kind: 'config',
    source_file: relPath,
  })
  edges.push({ source: fileNodeId, target: configNodeId, relation: 'defines', confidence: 'EXTRACTED' })
}

/**
 * Helper to resolve relative import path.
 */
function resolveRelativeImport(currentFile: string, importPath: string): string {
  const dir = dirname(currentFile)
  const resolved = join(dir, importPath).replace(/\\/g, '/')
  return `file:${resolved}`
}

/**
 * Link symbol references (calls, inherits) across nodes.
 */
function linkSymbolReferences(
  edges: GraphEdge[],
  symbolMap: Map<string, string>,
): void {
  for (const edge of edges) {
    if (edge.target.startsWith('class:') && !edge.target.includes('/')) {
      const targetName = edge.target.replace('class:', '')
      const realTarget = symbolMap.get(targetName)
      if (realTarget && realTarget !== edge.source) {
        edge.target = realTarget
      }
    }
  }
}
