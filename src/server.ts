import 'dotenv/config'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { tools } from './tools'
import { runChatTurn } from './chatAgent'
import type { ChatMessage } from '../types'

const port = Number(process.env.PORT || 3001)
const rootDir = process.cwd()
const resultsPath = path.join(rootDir, 'results.json')
const dashboardDistDir = path.join(rootDir, 'dashboard', 'dist')

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const sendJson = (response: import('node:http').ServerResponse, statusCode: number, payload: unknown) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

const sendText = (response: import('node:http').ServerResponse, statusCode: number, body: string) => {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(body)
}

const readBody = async (request: import('node:http').IncomingMessage) => {
  let body = ''

  for await (const chunk of request) {
    body += chunk
  }

  return body
}

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const message = value as Record<string, unknown>
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  )
}

const serveDashboardAsset = async (
  pathname: string,
  response: import('node:http').ServerResponse
) => {
  const requestedPath = pathname === '/' || pathname === '/stats' ? '/index.html' : pathname
  const assetPath = path.resolve(dashboardDistDir, `.${requestedPath}`)

  if (!assetPath.startsWith(dashboardDistDir)) {
    sendText(response, 403, 'Forbidden')
    return
  }

  try {
    const file = await readFile(assetPath)
    const extension = path.extname(assetPath)

    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    })
    response.end(file)
  } catch {
    try {
      const indexFile = await readFile(path.join(dashboardDistDir, 'index.html'))
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
      response.end(indexFile)
    } catch {
      sendText(
        response,
        404,
        'Dashboard build not found. Run `cd dashboard && bun run build` before starting the server.'
      )
    }
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/stats') {
    try {
      const file = await readFile(resultsPath, 'utf-8')
      sendJson(response, 200, JSON.parse(file))
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Failed to load stats',
      })
    }
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const body = await readBody(request)
      const payload = JSON.parse(body) as { messages?: unknown }

      if (!Array.isArray(payload.messages) || !payload.messages.every(isChatMessage)) {
        sendJson(response, 400, {
          error: 'Expected `messages` to be an array of { role, content } chat messages.',
        })
        return
      }

      const result = await runChatTurn({
        messages: payload.messages,
        tools,
      })

      sendJson(response, 200, result)
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Failed to handle chat request',
      })
    }
    return
  }

  if (request.method === 'GET') {
    await serveDashboardAsset(url.pathname, response)
    return
  }

  sendText(response, 404, 'Not found')
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})