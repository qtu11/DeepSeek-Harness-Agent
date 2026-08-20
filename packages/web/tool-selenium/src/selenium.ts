/**
 * Model-facing Selenium PowerShell Automation Tool.
 * Wraps the bundled PowerShell Selenium cmdlets in `tools/selenium-powershell`.
 *
 * @module @deepseek-ai/dsh-tool-selenium/selenium
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

export const DEFAULT_SELENIUM_TIMEOUT_MS = 60_000

export interface SeleniumExecuteArgs {
  script: string
  timeout_ms?: number
}

export interface SeleniumExecuteResultValue {
  stdout: string
  stderr: string
  exitCode?: number
  executionTimeMs: number
}

/** Resolves absolute path to Selenium.psd1 in tools/selenium-powershell. */
export function resolveSeleniumModulePath(baseDir = process.cwd()): string {
  const candidates = [
    path.resolve(baseDir, 'tools/selenium-powershell/Selenium.psd1'),
    path.resolve(baseDir, '../tools/selenium-powershell/Selenium.psd1'),
    path.resolve(baseDir, '../../tools/selenium-powershell/Selenium.psd1'),
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }

  return candidates[0] ?? ''
}

/** Formats selenium execution output. */
export function formatSeleniumOutput(result: SeleniumExecuteResultValue): string {
  const parts: string[] = []

  if (result.stdout.trim().length > 0) {
    parts.push(`--- STDOUT ---\n${result.stdout.trim()}`)
  }

  if (result.stderr.trim().length > 0) {
    parts.push(`--- STDERR ---\n${result.stderr.trim()}`)
  }

  if (parts.length === 0) {
    parts.push('(Selenium script completed successfully with no console output)')
  }

  if (result.exitCode !== 0 && result.exitCode !== null) {
    parts.push(`[Process exited with non-zero code: ${result.exitCode}]`)
  }

  return parts.join('\n\n')
}

/** Execute PowerShell script with Selenium module pre-imported. */
export function runSeleniumScript(
  userScript: string,
  timeoutMs = DEFAULT_SELENIUM_TIMEOUT_MS,
  baseDir = process.cwd(),
): Promise<SeleniumExecuteResultValue> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const modulePath = resolveSeleniumModulePath(baseDir).replace(/\\/g, '/')

    const fullScript = [
      '$ErrorActionPreference = \'Stop\'',
      `if (Test-Path '${modulePath}') { Import-Module '${modulePath}' -Force } else { Write-Warning 'Selenium module not found at ${modulePath}' }`,
      userScript,
    ].join('\n')

    const child = child_process.spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      fullScript,
    ], {
      cwd: baseDir,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to spawn PowerShell: ${err.message}`))
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)

      if (timedOut) {
        return resolve({
          stdout,
          stderr: `${stderr}\nExecution timed out after ${timeoutMs}ms`,
          exitCode: -1,
          executionTimeMs: Date.now() - startTime,
        })
      }

      resolve({
        stdout,
        stderr,
        ...exitCode !== null ? { exitCode } : {},
        executionTimeMs: Date.now() - startTime,
      })
    })
  })
}

/** Register selenium_execute tool in Cordis context. */
export function applySeleniumTool(
  ctx: Context,
  defaultTimeoutMs = DEFAULT_SELENIUM_TIMEOUT_MS,
): void {
  ctx.systemPrompt.section({
    name: 'tool:selenium_execute',
    order: 114,
    text: [
      'Use `selenium_execute` to run Selenium PowerShell scripts for advanced browser automation, testing, and scraping on Windows.',
      'Common cmdlets: `Start-SeDriver -Browser Chrome -Headless`, `Enter-SeUrl -Url <url>`, `Find-SeElement -By CssSelector -Value <sel>`, `Invoke-SeClick -Element <e>`, `Send-SeKeys -Element <e> -Keys <text>`, `Get-SeScreenshot -Path <path>`, `Stop-SeDriver`.',
    ].join(' '),
  })

  ctx.tools.register(defineTool({
    name: 'selenium_execute',
    description: 'Execute PowerShell script using the bundled Selenium WebDriver module (Chrome/Edge/Firefox automation).',
    parameters: {
      script: {
        type: 'string',
        required: true,
        description: 'PowerShell script block to execute with Selenium module loaded.',
      },
      timeout_ms: {
        type: 'number',
        description: `Execution timeout in ms. Defaults to ${defaultTimeoutMs}ms.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stdout: { type: 'string', required: true },
          stderr: { type: 'string', required: true },
          exitCode: { type: 'integer' },
          executionTimeMs: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatSeleniumOutput(value as unknown as SeleniumExecuteResultValue) }],
    },
    presentCall: (args): GenericCallView => ({
      card: 'generic',
      kind: 'execute',
      title: 'Selenium PowerShell',
      rawInput: String(args.script ?? ''),
    }),
    presentResult: (args): GenericCallView => ({
      card: 'generic',
      kind: 'execute',
      title: 'Selenium PowerShell',
      rawInput: String(args.script ?? ''),
    }),
    execute: async (args): Promise<SeleniumExecuteResultValue> => {
      const rawArgs = args as unknown as SeleniumExecuteArgs
      if (!rawArgs.script || typeof rawArgs.script !== 'string') {
        throw new Error('selenium_execute: script must be a non-empty string')
      }

      const timeout = rawArgs.timeout_ms ?? defaultTimeoutMs
      return await runSeleniumScript(rawArgs.script, timeout, process.cwd())
    },
  }))
}
