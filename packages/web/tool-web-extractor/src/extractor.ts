/**
 * Model-facing Web Extractor Tool: fetches and cleans web pages,
 * removing boilerplate and converting content to clean structured Markdown.
 * Inspired by Qwen-Agent web_extractor architecture.
 *
 * @module @deepseek-ai/dsh-tool-web-extractor/extractor
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

export const DEFAULT_WEB_EXTRACT_TIMEOUT_MS = 25_000

export interface WebExtractArgs {
  url: string
  timeout_ms?: number
  max_length?: number
}

export interface WebExtractResultValue {
  url: string
  title: string
  description?: string
  markdown: string
  wordCount: number
  status: number
}

/** Converts raw HTML to clean markdown text by removing boilerplate. */
export function cleanHtmlToMarkdown(html: string): { title: string; description?: string; markdown: string } {
  // 1. Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = titleMatch ? titleMatch[1]?.trim() ?? '' : ''
  const title = decodeHtmlEntities(rawTitle.replace(/\s+/g, ' '))

  // 2. Extract description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)
    || html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i)
  const description = descMatch ? decodeHtmlEntities(descMatch[1]?.trim() ?? '') : undefined

  // 3. Remove non-content tags: script, style, noscript, svg, nav, footer, header, aside, form, iframe
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // 4. Convert headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
  clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
  clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')

  // 5. Convert lists
  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
  clean = clean.replace(/<\/(ul|ol)>/gi, '\n')

  // 6. Convert code and pre
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
  clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // 7. Convert paragraphs and line breaks
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
  clean = clean.replace(/<br\s*\/?>/gi, '\n')
  clean = clean.replace(/<hr\s*\/?>/gi, '\n---\n')

  // 8. Convert blockquotes
  clean = clean.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')

  // 9. Convert links
  clean = clean.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim()
    return cleanText ? `[${cleanText}](${href})` : ''
  })

  // 10. Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, ' ')

  // 11. Decode entities and normalize whitespace
  clean = decodeHtmlEntities(clean)
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const markdown = lines.join('\n\n')

  return {
    title,
    ...description !== undefined ? { description } : {},
    markdown,
  }
}

/** Decode common HTML entities. */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&copy;/g, '©')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

/** Fetch a URL and extract its clean article content. */
export async function fetchAndExtractUrl(
  url: string,
  timeoutMs = DEFAULT_WEB_EXTRACT_TIMEOUT_MS,
  maxLength = 30_000,
): Promise<WebExtractResultValue> {
  const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      },
    })

    const status = res.status
    const contentType = res.headers.get('content-type') || ''
    const rawText = await res.text()

    let title = ''
    let description: string | undefined
    let markdown = ''

    if (contentType.includes('text/html') || rawText.includes('<html') || rawText.includes('<body')) {
      const parsed = cleanHtmlToMarkdown(rawText)
      title = parsed.title || targetUrl
      description = parsed.description
      markdown = parsed.markdown
    } else {
      title = targetUrl
      markdown = rawText
    }

    if (markdown.length > maxLength) {
      markdown = `${markdown.slice(0, maxLength)}\n\n...[Content truncated, total ${markdown.length} characters]`
    }

    const words = markdown.split(/\s+/).filter(Boolean)

    return {
      url: targetUrl,
      title,
      ...description !== undefined ? { description } : {},
      markdown,
      wordCount: words.length,
      status,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Format extracted web article into model-facing string. */
export function formatWebExtractOutput(result: WebExtractResultValue): string {
  const header = [
    `# ${result.title}`,
    `Source: ${result.url}`,
    result.description ? `Description: ${result.description}` : null,
    `Word Count: ${result.wordCount} | Status: ${result.status}`,
    '---',
  ].filter(Boolean).join('\n')

  return `${header}\n\n${result.markdown}`
}

/** Register web_extract tool in Cordis context. */
export function applyWebExtractorTool(
  ctx: Context,
  defaultTimeoutMs = DEFAULT_WEB_EXTRACT_TIMEOUT_MS,
): void {
  ctx.systemPrompt.section({
    name: 'tool:web_extract',
    order: 112,
    text: 'Use `web_extract` to read any web page or online article. It automatically extracts main text, converts to clean Markdown, and strips out ads/navigation.',
  })

  ctx.tools.register(defineTool({
    name: 'web_extract',
    description: 'Fetch and extract the main article content of any website or URL in clean Markdown format.',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The target web page URL to extract content from.',
      },
      timeout_ms: {
        type: 'number',
        description: `Request timeout in ms. Defaults to ${defaultTimeoutMs}ms.`,
      },
      max_length: {
        type: 'number',
        description: 'Maximum content characters to return. Defaults to 30000.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
          description: { type: 'string' },
          markdown: { type: 'string', required: true },
          wordCount: { type: 'integer', required: true },
          status: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatWebExtractOutput(value as unknown as WebExtractResultValue) }],
    },
    presentCall: (args): GenericCallView => ({
      card: 'generic',
      kind: 'read',
      title: `Extract Web: ${String(args.url ?? '')}`,
      rawInput: String(args.url ?? ''),
    }),
    presentResult: (args): GenericCallView => ({
      card: 'generic',
      kind: 'read',
      title: `Extract Web: ${String(args.url ?? '')}`,
      rawInput: String(args.url ?? ''),
    }),
    execute: async (args): Promise<WebExtractResultValue> => {
      const rawArgs = args as unknown as WebExtractArgs
      if (!rawArgs.url || typeof rawArgs.url !== 'string') {
        throw new Error('web_extract: url must be a non-empty string')
      }

      const timeout = rawArgs.timeout_ms ?? defaultTimeoutMs
      const maxLen = rawArgs.max_length ?? 30_000
      return await fetchAndExtractUrl(rawArgs.url, timeout, maxLen)
    },
  }))
}
