/**
 * Codebase Knowledge Graph construction, topology analysis, community clustering,
 * and graph query algorithms.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/graph
 */

import type {
  CodebaseGraph,
  GraphEdge,
  GraphNode,
} from './types.ts'

/**
 * Build graph data structure from scanned nodes and edges.
 */
export function buildCodebaseGraph(
  rootDir: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  languageCounts: Record<string, number>,
): CodebaseGraph {
  const nodeMap = new Map<string, GraphNode>()
  const inDegree: Record<string, number> = {}
  const outDegree: Record<string, number> = {}

  for (const node of nodes) {
    nodeMap.set(node.id, node)
    inDegree[node.id] = 0
    outDegree[node.id] = 0
  }

  // Deduplicate and filter valid edges
  const edgeSet = new Set<string>()
  const validEdges: GraphEdge[] = []

  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}:${edge.relation}`
    if (!edgeSet.has(key) && edge.source !== edge.target) {
      edgeSet.add(key)
      validEdges.push(edge)

      outDegree[edge.source] = (outDegree[edge.source] || 0) + 1
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1
    }
  }

  // Detect communities (directory-based modular clusters)
  const communities: Record<string, string[]> = {}
  for (const node of nodes) {
    const comm = detectNodeCommunity(node)
    node.community = comm
    if (!communities[comm]) {
      communities[comm] = []
    }
    communities[comm].push(node.id)
  }

  // Detect God Nodes (high centrality nodes)
  const godNodes = detectGodNodes(nodes, inDegree, outDegree)

  // Detect Circular Dependencies
  const circularDeps = detectCycles(nodes, validEdges)

  // File count
  const fileCount = nodes.filter(n => n.kind === 'file').length

  return {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    root: rootDir,
    nodes,
    edges: validEdges,
    communities,
    god_nodes: godNodes,
    circular_dependencies: circularDeps,
    summary: {
      total_files: fileCount,
      total_nodes: nodes.length,
      total_edges: validEdges.length,
      languages: languageCounts,
      communities_count: Object.keys(communities).length,
    },
  }
}

/**
 * Assign community based on package/module paths.
 */
function detectNodeCommunity(node: GraphNode): string {
  const parts = node.source_file.split('/')
  if (parts.length <= 1) return 'root'
  if (parts[0] === 'packages' && parts.length > 2 && parts[1] && parts[2]) {
    return `${parts[1]}/${parts[2]}`
  }
  if (parts[0] === 'apps' && parts.length > 1 && parts[1]) {
    return `apps/${parts[1]}`
  }
  return parts[0] || 'root'
}

/**
 * Detect top connected "God Nodes" (hub nodes).
 */
function detectGodNodes(
  nodes: GraphNode[],
  inDegree: Record<string, number>,
  outDegree: Record<string, number>,
): string[] {
  const scored = nodes
    .filter(n => n.kind !== 'config')
    .map((node) => {
      const inDeg = inDegree[node.id] || 0
      const outDeg = outDegree[node.id] || 0
      const totalDegree = inDeg * 2 + outDeg // weighted in-degree higher
      return { id: node.id, degree: totalDegree }
    })
    .sort((a, b) => b.degree - a.degree)

  return scored.slice(0, 10).filter(s => s.degree >= 3).map(s => s.id)
}

/**
 * Detect cycles in the directed graph using DFS.
 */
function detectCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.relation === 'imports' || edge.relation === 'calls' || edge.relation === 'depends_on') {
      const list = adj.get(edge.source) || []
      list.push(edge.target)
      adj.set(edge.source, list)
    }
  }

  const visited = new Set<string>()
  const recStack = new Set<string>()
  const path: string[] = []
  const cycles: string[][] = []

  function dfs(u: string): void {
    visited.add(u)
    recStack.add(u)
    path.push(u)

    const neighbors = adj.get(u) || []
    for (const v of neighbors) {
      if (!visited.has(v)) {
        dfs(v)
      } else if (recStack.has(v)) {
        const cycleStartIndex = path.indexOf(v)
        if (cycleStartIndex !== -1) {
          cycles.push(path.slice(cycleStartIndex).concat(v))
        }
      }
    }

    path.pop()
    recStack.delete(u)
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id)
      if (cycles.length >= 10) break
    }
  }

  return cycles
}

/**
 * Query neighborhood (upstream callers and downstream dependencies) of a node.
 */
export function queryNeighborhood(
  graph: CodebaseGraph,
  nodeQuery: string,
  _depth = 1,
): {
  targetNode: GraphNode | undefined
  incoming: Array<{ source: GraphNode | undefined; relation: string }>
  outgoing: Array<{ target: GraphNode | undefined; relation: string }>
  siblings: GraphNode[]
} {
  const nodeMap = new Map<string, GraphNode>()
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n)
  }

  // Match query to node id or label
  let targetNode = nodeMap.get(nodeQuery)
  if (!targetNode) {
    const qLower = nodeQuery.toLowerCase()
    targetNode = graph.nodes.find(
      n => n.label.toLowerCase() === qLower || n.source_file.toLowerCase().includes(qLower),
    )
  }

  if (!targetNode) {
    return { targetNode: undefined, incoming: [], outgoing: [], siblings: [] }
  }

  const incoming: Array<{ source: GraphNode | undefined; relation: string }> = []
  const outgoing: Array<{ target: GraphNode | undefined; relation: string }> = []

  for (const edge of graph.edges) {
    if (edge.target === targetNode.id) {
      incoming.push({ source: nodeMap.get(edge.source), relation: edge.relation })
    } else if (edge.source === targetNode.id) {
      outgoing.push({ target: nodeMap.get(edge.target), relation: edge.relation })
    }
  }

  const targetId = targetNode.id
  const siblings: GraphNode[] = targetNode.community
    ? (graph.communities[targetNode.community] || [])
      .filter(id => id !== targetId)
      .slice(0, 10)
      .map(id => nodeMap.get(id))
      .filter((n): n is GraphNode => n !== undefined)
    : []

  return { targetNode, incoming, outgoing, siblings }
}

/**
 * Query shortest path between two nodes (BFS).
 */
export function queryShortestPath(
  graph: CodebaseGraph,
  startQuery: string,
  endQuery: string,
): string[] | null {
  const nodeMap = new Map<string, GraphNode>()
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n)
  }

  const startNode = nodeMap.get(startQuery) || graph.nodes.find(n => n.label === startQuery)
  const endNode = nodeMap.get(endQuery) || graph.nodes.find(n => n.label === endQuery)

  if (!startNode || !endNode) return null

  const adj = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = adj.get(edge.source) || []
    list.push(edge.target)
    adj.set(edge.source, list)
  }

  const queue: Array<{ curr: string; path: string[] }> = [{ curr: startNode.id, path: [startNode.id] }]
  const visited = new Set<string>([startNode.id])

  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    const { curr, path } = item
    if (curr === endNode.id) {
      return path
    }

    const neighbors = adj.get(curr) || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ curr: next, path: [...path, next] })
      }
    }
  }

  return null
}

/**
 * Generate comprehensive Markdown report from graph (GRAPH_REPORT.md).
 */
export function generateGraphReportMarkdown(graph: CodebaseGraph): string {
  const lines: string[] = []

  lines.push('# Codebase Architecture Knowledge Graph Report')
  lines.push(`*Generated at: ${graph.generated_at} | Root: ${graph.root}*`)
  lines.push('')
  lines.push('## 1. Executive Summary')
  lines.push(`- **Total Source Files**: ${graph.summary.total_files}`)
  lines.push(`- **Total Graph Nodes**: ${graph.summary.total_nodes}`)
  lines.push(`- **Total Graph Edges**: ${graph.summary.total_edges}`)
  lines.push(`- **Architectural Communities**: ${graph.summary.communities_count}`)
  lines.push('')
  lines.push('### Languages Breakdown')
  for (const [lang, count] of Object.entries(graph.summary.languages)) {
    lines.push(`- **${lang}**: ${count} files`)
  }
  lines.push('')

  lines.push('## 2. Core Architectural Hubs (God Nodes)')
  lines.push('These components represent high-centrality foundational modules:')
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
  for (const godId of graph.god_nodes) {
    const node = nodeMap.get(godId)
    if (node) {
      lines.push(`- \`${node.id}\` (${node.kind} in \`${node.source_file}\`) - ${node.label}`)
    }
  }
  lines.push('')

  lines.push('## 3. Subsystem Communities & Modules')
  for (const [commName, nodeIds] of Object.entries(graph.communities)) {
    lines.push(`### Community: \`${commName}\` (${nodeIds.length} elements)`)
    const sampleNodes = nodeIds.slice(0, 4)
    for (const nid of sampleNodes) {
      const n = nodeMap.get(nid)
      if (n) {
        lines.push(`  - [${n.kind}] \`${n.label}\` (\`${n.source_file}\`)`)
      }
    }
    if (nodeIds.length > 4) {
      lines.push(`  - *...and ${nodeIds.length - 4} more elements*`)
    }
    lines.push('')
  }

  if (graph.circular_dependencies.length > 0) {
    lines.push('## 4. Circular Dependencies Detected')
    for (const cycle of graph.circular_dependencies) {
      lines.push(`- ${cycle.map(c => `\`${c}\``).join(' → ')}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('*Generated deterministically by DeepSeek Harness Graphify Plugin*')

  return lines.join('\n')
}
