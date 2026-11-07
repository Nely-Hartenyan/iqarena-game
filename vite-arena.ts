import os from 'node:os'
import type { Connect, Plugin } from 'vite'

type ArenaSnap = {
  teams: { id: string; name: string }[]
  armed: boolean
  activeId: string | null
  locked: string[]
  round: string
  ready: boolean
}

type ArenaEvent =
  | { type: 'state'; state: ArenaSnap }
  | { type: 'buzz'; teamId: string }

type Client = { write: (chunk: string) => void; end?: () => void }

function lanBuzzUrls(port: number) {
  const urls: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`)
      }
    }
  }
  return urls
}

function readBody(req: Connect.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function arenaPlugin(): Plugin {
  let last: ArenaSnap = {
    teams: [],
    armed: false,
    activeId: null,
    locked: [],
    round: '',
    ready: false,
  }
  const clients = new Set<Client>()
  let port = 5182

  const send = (client: Client, event: ArenaEvent) => {
    client.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const broadcast = (event: ArenaEvent) => {
    for (const client of clients) {
      try {
        send(client, event)
      } catch {
        clients.delete(client)
      }
    }
  }

  const attach = (middlewares: Connect.Server) => {
    middlewares.use(async (req, res, next) => {
      const url = req.url?.split('?')[0] ?? ''
      if (url === '/api/arena/info' && req.method === 'GET') {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ buzzUrls: lanBuzzUrls(port) }))
        return
      }
      if (url === '/api/arena/events' && req.method === 'GET') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        const client: Client = {
          write: (chunk) => res.write(chunk),
          end: () => res.end(),
        }
        clients.add(client)
        res.write(': connected\n\n')
        send(client, { type: 'state', state: last })
        req.on('close', () => clients.delete(client))
        return
      }
      if (url === '/api/arena' && req.method === 'POST') {
        try {
          const raw = await readBody(req)
          const data = JSON.parse(raw) as ArenaEvent
          if (data.type === 'state' && data.state) {
            last = data.state
            broadcast({ type: 'state', state: last })
          } else if (data.type === 'buzz' && typeof data.teamId === 'string') {
            broadcast({ type: 'buzz', teamId: data.teamId })
          }
          res.statusCode = 204
          res.end()
        } catch {
          res.statusCode = 400
          res.end('bad request')
        }
        return
      }
      next()
    })
  }

  return {
    name: 'iq-arena-link',
    configureServer(server) {
      port = server.config.server.port ?? 5182
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      port = server.config.preview.port ?? port
      attach(server.middlewares)
    },
  }
}
