import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolWebExtractor from '@deepseek-ai/dsh-tool-web-extractor'
import { cleanHtmlToMarkdown, formatWebExtractOutput } from '../src/extractor.ts'

describe('tool-web-extractor', () => {
  it('cleans raw HTML and extracts title, headers and links into markdown', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DeepSeek Harness Architecture</title>
          <meta name="description" content="A comprehensive overview of DeepSeek Agent plugins.">
          <style>body { color: red; }</style>
          <script>console.log('spam');</script>
        </head>
        <body>
          <header><nav><a href="/home">Home</a></nav></header>
          <main>
            <h1>DeepSeek Autonomous Agent</h1>
            <p>DeepSeek Harness is an enterprise-grade agent harness built on Cordis.</p>
            <h2>Core Features</h2>
            <ul>
              <li>Persistent Project Memory</li>
              <li>Python Interpreter</li>
              <li>Browser Automation</li>
            </ul>
            <p>Read more at <a href="https://deepseek.com">DeepSeek Official</a>.</p>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `

    const parsed = cleanHtmlToMarkdown(rawHtml)
    expect(parsed.title).toBe('DeepSeek Harness Architecture')
    expect(parsed.description).toBe('A comprehensive overview of DeepSeek Agent plugins.')
    expect(parsed.markdown).toContain('# DeepSeek Autonomous Agent')
    expect(parsed.markdown).toContain('## Core Features')
    expect(parsed.markdown).toContain('Persistent Project Memory')
    expect(parsed.markdown).toContain('[DeepSeek Official](https://deepseek.com)')
    expect(parsed.markdown).not.toContain('console.log')
    expect(parsed.markdown).not.toContain('Copyright 2026')
  })

  it('formats web extract output structure', () => {
    const formatted = formatWebExtractOutput({
      url: 'https://example.com/docs',
      title: 'Example Documentation',
      description: 'Test page description',
      markdown: 'Main body content.',
      wordCount: 3,
      status: 200,
    })

    expect(formatted).toContain('# Example Documentation')
    expect(formatted).toContain('Source: https://example.com/docs')
    expect(formatted).toContain('Description: Test page description')
    expect(formatted).toContain('Main body content.')
  })

  it('mounts plugin in Cordis and registers web_extract tool', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(toolWebExtractor, { enabled: true })

    const toolNames = ctx.tools.schemas().map(s => s.name)
    expect(toolNames).toContain('web_extract')

    await fiber.dispose()
  })
})
