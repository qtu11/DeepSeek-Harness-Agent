/**
 * Model-facing Python Code Interpreter Tool.
 * Inspired by Qwen-Agent code_interpreter & python_executor architecture.
 *
 * @module @deepseek-ai/dsh-tool-python-interpreter/interpreter
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

export const DEFAULT_PYTHON_TIMEOUT_MS = 30_000

export interface PythonExecuteArgs {
  code: string
  timeout_ms?: number
}

export interface PythonExecuteResultValue {
  stdout: string
  stderr: string
  exitCode?: number
  executionTimeMs: number
  generatedFiles?: string[]
}

/** Formats python execution output for model consumption. */
export function formatPythonOutput(result: PythonExecuteResultValue): string {
  const parts: string[] = []

  if (result.stdout.trim().length > 0) {
    parts.push(`--- STDOUT ---\n${result.stdout.trim()}`)
  }

  if (result.stderr.trim().length > 0) {
    parts.push(`--- STDERR ---\n${result.stderr.trim()}`)
  }

  if (parts.length === 0) {
    parts.push('(Code executed successfully with no output)')
  }

  if (result.exitCode !== 0 && result.exitCode !== null) {
    parts.push(`[Process exited with non-zero code: ${result.exitCode}]`)
  }

  if (result.generatedFiles && result.generatedFiles.length > 0) {
    parts.push(`Generated Artifacts:\n${result.generatedFiles.map(f => `  - ${f}`).join('\n')}`)
  }

  return parts.join('\n\n')
}

/** Detect available python executable path/command. */
export function detectPythonCommand(): string {
  if (process.env['PYTHON_PATH'] && fs.existsSync(process.env['PYTHON_PATH'])) {
    return process.env['PYTHON_PATH']
  }
  // Try standard commands
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python']

  return candidates[0] ?? 'python'
}

/** Execute Python code string synchronously/asynchronously. */
export function runPythonCode(
  code: string,
  timeoutMs = DEFAULT_PYTHON_TIMEOUT_MS,
  cwd = process.cwd(),
): Promise<PythonExecuteResultValue> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const pyCmd = detectPythonCommand()

    const tempDir = os.tmpdir()
    const scriptPath = path.join(tempDir, `dsh_py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)

    try {
      fs.writeFileSync(scriptPath, code, 'utf8')
    } catch (err) {
      return reject(new Error(`Failed to write temporary python script: ${String(err)}`))
    }

    const child = child_process.spawn(pyCmd, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
      },
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
      try {
        fs.unlinkSync(scriptPath)
      } catch {
        // ignore
      }
      reject(new Error(`Failed to spawn python process (${pyCmd}): ${err.message}`))
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      try {
        fs.unlinkSync(scriptPath)
      } catch {
        // ignore
      }

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

/** Register python_execute tool in Cordis context. */
export function applyPythonInterpreterTool(
  ctx: Context,
  defaultTimeoutMs = DEFAULT_PYTHON_TIMEOUT_MS,
): void {
  ctx.systemPrompt.section({
    name: 'tool:python_execute',
    order: 110,
    text: 'Use `python_execute` to run arbitrary Python code for mathematical computation, data processing (pandas/numpy), algorithm simulation, or script execution.',
  })

  ctx.tools.register(defineTool({
    name: 'python_execute',
    description: 'Execute Python code in a local environment and return stdout, stderr, and output values. Useful for math, data analytics, and scripting.',
    parameters: {
      code: {
        type: 'string',
        required: true,
        description: 'The Python source code to execute.',
      },
      timeout_ms: {
        type: 'number',
        description: `Execution timeout in milliseconds. Defaults to ${defaultTimeoutMs}ms.`,
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
      render: (_args, value) => [{ type: 'text', text: formatPythonOutput(value as unknown as PythonExecuteResultValue) }],
    },
    presentCall: (args): GenericCallView => ({
      card: 'generic',
      kind: 'execute',
      title: 'Python Execute',
      rawInput: String(args.code ?? ''),
    }),
    presentResult: (args): GenericCallView => ({
      card: 'generic',
      kind: 'execute',
      title: 'Python Execute',
      rawInput: String(args.code ?? ''),
    }),
    execute: async (args): Promise<PythonExecuteResultValue> => {
      const rawArgs = args as unknown as PythonExecuteArgs
      if (!rawArgs.code || typeof rawArgs.code !== 'string') {
        throw new Error('python_execute: code must be a non-empty string')
      }

      const timeout = rawArgs.timeout_ms ?? defaultTimeoutMs
      return await runPythonCode(rawArgs.code, timeout, process.cwd())
    },
  }))
}
