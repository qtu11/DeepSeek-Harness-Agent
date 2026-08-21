#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const MNEMON_DIR = join(homedir(), '.mnemon')
const DATA_DIR = join(MNEMON_DIR, 'data')
const STATE_DIR = join(MNEMON_DIR, 'state')
const DEFAULT_STORE_DIR = join(DATA_DIR, 'default')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(STATE_DIR, { recursive: true })
mkdirSync(DEFAULT_STORE_DIR, { recursive: true })

// 1. Create a dummy mnemon.db in default store directory
const dbPath = join(DEFAULT_STORE_DIR, 'mnemon.db')
if (!existsSync(dbPath)) {
  writeFileSync(dbPath, 'SQLite format 3\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0', 'binary')
}

// 2. Write .dsh-memory-bodies.json
const timestamp = new Date().toISOString()
const bodiesRegistry = {
  version: 1,
  bodies: [
    {
      id: 'default',
      name: 'Bộ nhớ mặc định',
      description: 'Không gian bộ nhớ chính cho tác vụ lập trình và hội thoại.',
      active: true,
      providerId: 'mnemon-native',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
}
writeFileSync(join(DATA_DIR, '.dsh-memory-bodies.json'), JSON.stringify(bodiesRegistry, null, 2), 'utf8')

// 3. Write active store pointer
writeFileSync(join(MNEMON_DIR, 'active'), 'default\n', 'utf8')

// 4. Configure all memory providers
const providersConfig = {
  version: 4,
  services: {
    openviking: { url: 'http://127.0.0.1:23080/api/memory/openviking' },
    honcho: { url: 'http://127.0.0.1:23080/api/memory/honcho', apiKey: 'dsh-honcho-active' },
    mem0: { apiKey: 'dsh-mem0-active' },
    hindsight: { url: 'http://127.0.0.1:23080/api/memory/hindsight', apiKey: 'dsh-hindsight-active' },
    holographic: { dataPath: join(STATE_DIR, 'holographic', 'store.json') },
    retaindb: { apiKey: 'dsh-retaindb-active' },
    byterover: { cliPath: 'mnemon', defaultDirectory: join(STATE_DIR, 'byterover', 'default') },
    supermemory: { apiKey: 'dsh-supermemory-active' }
  },
  enabled: {
    openviking: true,
    honcho: true,
    mem0: true,
    hindsight: true,
    holographic: true,
    retaindb: true,
    byterover: true,
    supermemory: true
  },
  bodies: [
    {
      id: 'default',
      name: 'Bộ nhớ mặc định',
      description: 'Không gian bộ nhớ chính cho tác vụ lập trình và hội thoại.',
      active: true,
      providerId: 'mnemon-native',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
}

writeFileSync(join(STATE_DIR, 'memory-providers.json'), JSON.stringify(providersConfig, null, 2), 'utf8')

console.log('✓ Initialized Mnemon default memory space and all providers!')
