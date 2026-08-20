/**
 * Type definitions for the Code Knowledge Graph and Work Memory engine.
 *
 * @module @deepseek-ai/dsh-tool-fs-graphify/types
 */

export type NodeKind =
  | 'file'
  | 'module'
  | 'class'
  | 'interface'
  | 'type'
  | 'function'
  | 'method'
  | 'endpoint'
  | 'config'
  | 'schema'

export type EdgeRelation =
  | 'calls'
  | 'imports'
  | 'defines'
  | 'inherits'
  | 'depends_on'
  | 'implements'

export type EdgeConfidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'

export interface GraphNode {
  id: string
  label: string
  kind: NodeKind
  source_file: string
  source_location?: string | undefined
  community?: string | undefined
  description?: string | undefined
  exported?: boolean | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface GraphEdge {
  source: string
  target: string
  relation: EdgeRelation
  confidence: EdgeConfidence
}

export interface CodebaseGraph {
  version: string
  generated_at: string
  root: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  communities: Record<string, string[]>
  god_nodes: string[]
  circular_dependencies: string[][]
  summary: {
    total_files: number
    total_nodes: number
    total_edges: number
    languages: Record<string, number>
    communities_count: number
  }
}

export type OutcomeType = 'useful' | 'dead_end' | 'corrected'

export interface MemoryEntry {
  id: string
  question: string
  answer: string
  type: string
  source_nodes: string[]
  outcome: OutcomeType
  correction?: string | undefined
  created_at: string
}

export type LessonStatus = 'preferred' | 'tentative' | 'contested' | 'dead_end' | 'corrected'

export interface LessonItem {
  node_id: string
  label: string
  source_file?: string | undefined
  status: LessonStatus
  score: number
  corroboration_count: number
  positive_count: number
  negative_count: number
  latest_outcome: OutcomeType
  latest_date: string
  correction?: string | undefined
  community?: string | undefined
  notes?: string | undefined
}

export interface ReflectionReport {
  generated_at: string
  total_memories: number
  preferred_sources: LessonItem[]
  tentative_sources: LessonItem[]
  contested_sources: LessonItem[]
  known_dead_ends: LessonItem[]
  corrections: LessonItem[]
  lessons_markdown: string
}
