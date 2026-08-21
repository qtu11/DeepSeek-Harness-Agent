/**
 * DS2API Runner — automatically manages the local ds2api reverse-proxy process
 * when running DeepSeek Harness.
 * @module @deepseek-ai/dsh/ds2api-runner
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Root checkout directory */
const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const DS2API_DIR = join(ROOT_DIR, 'tools', 'ds2api')
const DS2API_EXE = join(DS2API_DIR, 'ds2api.exe')
const DS2API_CONFIG = join(DS2API_DIR, 'config.json')

export const DS2API_DEFAULT_PORT = parseInt(process.env.DS2API_PORT ?? '25001', 10)
export const DS2API_DEFAULT_BASE_URL = process.env.DS2API_BASE_URL ?? `http://127.0.0.1:${DS2API_DEFAULT_PORT}/v1`
export const DS2API_LOCAL_KEY = 'sk-ds2api-dsh-local'

interface Ds2ApiConfig {
  keys?: string[]
  api_keys?: Array<{ key: string; name?: string; remark?: string }>
  accounts?: Array<{ name?: string; remark?: string; email?: string; password?: string; token?: string }>
  model_aliases?: Record<string, string>
  runtime?: {
    account_max_inflight?: number
    account_max_queue?: number
    global_max_inflight?: number
    token_refresh_interval_hours?: number
  }
}

import { homedir } from 'node:os'

/**
 * Load tokens and credentials directly from .env files.
 */
function loadEnvTokens(): { token?: string; email?: string; password?: string } {
  const envPaths = [
    join(ROOT_DIR, '.env'),
    join(process.cwd(), '.env'),
    join(homedir(), '.dsh', '.env'),
  ]
  const result: { token?: string; email?: string; password?: string } = {}
  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue
    try {
      const content = readFileSync(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const match = /^([A-Z0-9_]+)=(.*)$/i.exec(trimmed)
        if (!match || match[1] === undefined || match[2] === undefined) continue
        const key = match[1]
        const val = match[2].trim().replace(/^['"]|['"]$/g, '')
        if (key === 'DS_USER_TOKEN' || key === 'DEEPSEEK_USER_TOKEN') result.token = val
        if (key === 'DS_EMAIL' || key === 'DEEPSEEK_EMAIL') result.email = val
        if (key === 'DS_PASSWORD' || key === 'DEEPSEEK_PASSWORD') result.password = val
      }
    } catch {
      // Ignore read errors
    }
  }
  return result
}

/**
 * Synchronize config.json for ds2api from environment variables and .env.
 */
function syncDs2ApiConfig(): Ds2ApiConfig {
  let config: Ds2ApiConfig = {}
  if (existsSync(DS2API_CONFIG)) {
    try {
      config = JSON.parse(readFileSync(DS2API_CONFIG, 'utf8')) as Ds2ApiConfig
    } catch {
      config = {}
    }
  }

  // Ensure default key exists
  if (!config.keys || config.keys.length === 0) {
    config.keys = [DS2API_LOCAL_KEY]
  }
  if (!config.api_keys || config.api_keys.length === 0) {
    config.api_keys = [{ key: DS2API_LOCAL_KEY, name: 'DeepSeek Harness Local Key', remark: 'Auto-configured' }]
  }

  const diskEnv = loadEnvTokens()
  const userToken = process.env.DS_USER_TOKEN ?? process.env.DEEPSEEK_USER_TOKEN ?? diskEnv.token ?? (
    process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.startsWith('sk-') ? process.env.DEEPSEEK_API_KEY : undefined
  )

  const email = process.env.DS_EMAIL ?? process.env.DEEPSEEK_EMAIL ?? diskEnv.email
  const password = process.env.DS_PASSWORD ?? process.env.DEEPSEEK_PASSWORD ?? diskEnv.password

  if (!config.accounts || config.accounts.length === 0) {
    config.accounts = [{
      name: 'DeepSeek Web Account',
      remark: 'DeepSeek Web Account',
      token: userToken ?? '',
      ...email ? { email } : {},
      ...password ? { password } : {},
    }]
  } else {
    const first = config.accounts[0]
    if (first) {
      if (userToken) first.token = userToken
      if (email) first.email = email
      if (password) first.password = password
    }
  }

  // Ensure models alias
  config.model_aliases = {
    'deepseek-v4-flash': 'deepseek-v4-flash',
    'deepseek-v4-pro': 'deepseek-v4-flash',
    'deepseek-chat': 'deepseek-v4-flash',
    'deepseek-reasoner': 'deepseek-v4-flash',
    ...config.model_aliases,
  }

  if (!config.runtime) {
    config.runtime = {
      account_max_inflight: 2,
      account_max_queue: 0,
      global_max_inflight: 0,
      token_refresh_interval_hours: 6,
    }
  }

  writeFileSync(DS2API_CONFIG, JSON.stringify(config, null, 2), 'utf8')

  return config
}

/**
 * Check if ds2api is already responding with HTTP 200 OK.
 */
async function isDs2ApiWorking(port: number = DS2API_DEFAULT_PORT): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      headers: { Authorization: `Bearer ${DS2API_LOCAL_KEY}` },
      signal: AbortSignal.timeout(1500),
    })
    return res.ok || res.status === 200
  } catch {
    return false
  }
}

/**
 * Push updated config dynamically to running ds2api instance.
 */
async function reloadRunningDs2Api(port: number, cfg: Ds2ApiConfig): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/admin/config`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accounts: cfg.accounts,
        api_keys: cfg.api_keys,
        keys: cfg.keys,
        model_aliases: cfg.model_aliases,
      }),
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Start ds2api background process if enabled or if ds2api.exe is present.
 * @returns cleanup disposer function.
 */
export async function ensureDs2ApiRunning(): Promise<() => void> {
  const disabled = process.env.DS2API_DISABLED === 'true' || process.env.DS2API_DISABLED === '1'
  if (disabled || !existsSync(DS2API_EXE)) {
    return () => {}
  }

  const syncedConfig = syncDs2ApiConfig()

  const shouldUseDs2Api = process.env.DS2API_ENABLED === 'true' ||
    process.env.DS2API_ENABLED === '1' ||
    Boolean(process.env.DS_USER_TOKEN) ||
    Boolean(process.env.DEEPSEEK_USER_TOKEN) ||
    process.env.DEEPSEEK_BASE_URL?.includes(String(DS2API_DEFAULT_PORT))

  if (shouldUseDs2Api) {
    process.env.DEEPSEEK_BASE_URL = DS2API_DEFAULT_BASE_URL
    process.env.DEEPSEEK_API_KEY = DS2API_LOCAL_KEY
  }

  // If already running, try to sync config dynamically
  if (await isDs2ApiWorking(DS2API_DEFAULT_PORT)) {
    await reloadRunningDs2Api(DS2API_DEFAULT_PORT, syncedConfig)
    console.log(`[ds2api] Proxy đang hoạt động và đã đồng bộ cấu hình tại http://127.0.0.1:${DS2API_DEFAULT_PORT}/v1`)
    return () => {}
  }

  let child: ChildProcess | undefined
  try {
    child = spawn(DS2API_EXE, [], {
      cwd: DS2API_DIR,
      env: {
        ...process.env,
        PORT: String(DS2API_DEFAULT_PORT),
        DS2API_AUTO_BUILD_WEBUI: 'false',
        DS2API_CONFIG_PATH: DS2API_CONFIG,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    child.unref()

    // Wait up to 6 seconds for ds2api to become ready
    const start = Date.now()
    while (Date.now() - start < 6000) {
      if (await isDs2ApiWorking(DS2API_DEFAULT_PORT)) {
        console.log(`[ds2api] Đã tự động khởi chạy ds2api tại http://127.0.0.1:${DS2API_DEFAULT_PORT}/v1`)
        break
      }
      await new Promise(r => setTimeout(r, 200))
    }
  } catch (error) {
    console.warn('dsh: failed to start ds2api process:', error)
  }

  return () => {
    if (child && !child.killed) {
      try {
        child.kill()
      } catch {
        // Process might have already exited
      }
    }
  }
}
