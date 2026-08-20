import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolSelenium from '@deepseek-ai/dsh-tool-selenium'
import { formatSeleniumOutput, resolveSeleniumModulePath } from '../src/selenium.ts'

describe('tool-selenium', () => {
  it('resolves selenium module path', () => {
    const p = resolveSeleniumModulePath()
    expect(typeof p).toBe('string')
    expect(p).toContain('Selenium.psd1')
  })

  it('formats selenium output correctly', () => {
    const formatted = formatSeleniumOutput({
      stdout: 'Driver initialized\nTitle: Google',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 1200,
    })

    expect(formatted).toContain('--- STDOUT ---')
    expect(formatted).toContain('Driver initialized')
    expect(formatted).toContain('Title: Google')
  })

  it('mounts plugin in Cordis and registers selenium_execute tool', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(toolSelenium, { enabled: true })

    const toolNames = ctx.tools.schemas().map(s => s.name)
    expect(toolNames).toContain('selenium_execute')

    await fiber.dispose()
  })
})
