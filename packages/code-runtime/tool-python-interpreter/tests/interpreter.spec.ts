import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolPython from '@deepseek-ai/dsh-tool-python-interpreter'
import { formatPythonOutput, runPythonCode } from '../src/interpreter.ts'

describe('tool-python-interpreter', () => {
  it('formats python execution output correctly', () => {
    const output = formatPythonOutput({
      stdout: 'Hello DeepSeek\n42',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 15,
    })
    expect(output).toContain('--- STDOUT ---')
    expect(output).toContain('Hello DeepSeek')
    expect(output).toContain('42')
  })

  it('formats non-zero exit code and stderr', () => {
    const output = formatPythonOutput({
      stdout: '',
      stderr: 'ZeroDivisionError: division by zero',
      exitCode: 1,
      executionTimeMs: 12,
    })
    expect(output).toContain('--- STDERR ---')
    expect(output).toContain('ZeroDivisionError')
    expect(output).toContain('[Process exited with non-zero code: 1]')
  })

  it('runs basic python code string', async () => {
    const res = await runPythonCode('print(123 + 456)', 10000)
    expect(res.stdout.trim()).toBe('579')
    expect(res.exitCode).toBe(0)
  })

  it('mounts plugin in Cordis and registers python_execute tool', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(toolPython, { enabled: true })

    const toolNames = ctx.tools.schemas().map(s => s.name)
    expect(toolNames).toContain('python_execute')

    await fiber.dispose()
  })
})
