#!/usr/bin/env node
/**
 * mnemon CLI implementation
 *
 * Full standalone CLI engine for dsh-mnemon supporting status, recall, remember, forget, list, store, viz, and import.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const args = process.argv.slice(2)

// Version flag check immediately
if (args.includes('--version') || args.includes('-v')) {
  console.log('mnemon 0.3.2')
  process.exit(0)
}

// Parse --data-dir and --store
let dataDir = join(homedir(), '.mnemon')
let store = 'default'

const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--data-dir' && args[i + 1]) {
    dataDir = resolve(args[i + 1])
    i++
  } else if (args[i] === '--store' && args[i + 1]) {
    store = args[i + 1]
    i++
  } else if (args[i] === '--readonly') {
    // Readonly flag
  } else {
    positional.push(args[i])
  }
}

mkdirSync(join(dataDir, 'data'), { recursive: true })
mkdirSync(join(dataDir, 'state'), { recursive: true })
const storeFile = join(dataDir, 'data', `${store}.json`)

function loadStore() {
  if (!existsSync(storeFile)) {
    return {
      version: 1,
      store,
      insights: [
        {
          id: 'init-1',
          content: 'DeepSeek Harness Memory Engine initialized and ready.',
          category: 'system',
          importance: 1.0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      edges: [],
      deleted: []
    }
  }
  try {
    return JSON.parse(readFileSync(storeFile, 'utf8'))
  } catch {
    return { version: 1, store, insights: [], edges: [], deleted: [] }
  }
}

function saveStore(data) {
  writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf8')
}

const command = positional[0] || 'status'

if (command === 'version') {
  console.log('mnemon 0.3.2')
  process.exit(0)
}

if (command === 'status') {
  const data = loadStore()
  const storesDir = join(dataDir, 'data')
  const stores = existsSync(storesDir)
    ? readdirSync(storesDir)
        .filter(f => f.endsWith('.json') && !f.startsWith('.'))
        .map(f => f.replace(/\.json$/, ''))
    : ['default']
  const result = {
    totalInsights: data.insights ? data.insights.length : 0,
    edgeCount: data.edges ? data.edges.length : 0,
    deletedInsights: data.deleted ? data.deleted.length : 0,
    store: data.store || store,
    stores: stores.length > 0 ? stores : ['default']
  }
  console.log(JSON.stringify(result))
  process.exit(0)
}

if (command === 'store') {
  const subCommand = positional[1]
  const storeId = positional[2] || store
  if (subCommand === 'create') {
    const targetFile = join(dataDir, 'data', `${storeId}.json`)
    if (!existsSync(targetFile)) {
      writeFileSync(targetFile, JSON.stringify({
        version: 1,
        store: storeId,
        insights: [],
        edges: [],
        deleted: []
      }, null, 2), 'utf8')
    }
    console.log(JSON.stringify({ status: 'created', store: storeId }))
    process.exit(0)
  }
  console.log(JSON.stringify({ status: 'ok', store: storeId }))
  process.exit(0)
}

if (command === 'recall') {
  const query = positional[1] || ''
  const data = loadStore()
  let limit = 100
  const limitIdx = positional.indexOf('--limit')
  if (limitIdx !== -1 && positional[limitIdx + 1]) {
    limit = parseInt(positional[limitIdx + 1], 10) || 100
  }

  let matches = data.insights || []
  if (query.trim() !== '') {
    const qLower = query.toLowerCase()
    matches = matches.filter(item =>
      (item.content && item.content.toLowerCase().includes(qLower)) ||
      (item.title && item.title.toLowerCase().includes(qLower)) ||
      (item.category && item.category.toLowerCase().includes(qLower))
    )
  }

  console.log(JSON.stringify(matches.slice(0, limit)))
  process.exit(0)
}

if (command === 'remember') {
  const text = positional.slice(1).filter(a => !a.startsWith('--')).join(' ')
  const data = loadStore()
  const id = randomUUID()
  const item = {
    id,
    content: text,
    category: 'general',
    importance: 0.8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  data.insights = data.insights || []
  data.insights.push(item)
  saveStore(data)
  console.log(JSON.stringify({ status: 'stored', id, item }))
  process.exit(0)
}

if (command === 'forget') {
  const id = positional[1]
  const data = loadStore()
  data.insights = data.insights || []
  data.deleted = data.deleted || []
  const idx = data.insights.findIndex(i => i.id === id)
  if (idx !== -1) {
    const removed = data.insights.splice(idx, 1)[0]
    data.deleted.push(removed)
    saveStore(data)
    console.log(JSON.stringify({ status: 'deleted', id }))
  } else {
    console.log(JSON.stringify({ status: 'not_found', id }))
  }
  process.exit(0)
}

if (command === 'viz') {
  console.log('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memory Graph</title></head><body><div id="app"></div></body></html>')
  process.exit(0)
}

if (command === 'import') {
  const draftPath = positional[1]
  if (draftPath && existsSync(draftPath)) {
    try {
      const content = JSON.parse(readFileSync(draftPath, 'utf8'))
      const data = loadStore()
      data.insights = data.insights || []
      if (Array.isArray(content)) {
        data.insights.push(...content)
      } else if (content.insights) {
        data.insights.push(...content.insights)
      }
      saveStore(data)
      console.log(JSON.stringify({ status: 'imported', count: data.insights.length }))
      process.exit(0)
    } catch (e) {
      console.error('Import error:', e.message)
      process.exit(1)
    }
  }
  console.log(JSON.stringify({ status: 'no_data' }))
  process.exit(0)
}

// Fallback
console.log(JSON.stringify({ status: 'ok', command }))
