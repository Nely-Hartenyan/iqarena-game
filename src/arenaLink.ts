export type ArenaTeam = { id: string; name: string }

export type ArenaSnap = {
  teams: ArenaTeam[]
  armed: boolean
  activeId: string | null
  locked: string[]
  round: string
  ready: boolean
}

export type ArenaIncoming =
  | { type: 'state'; state: ArenaSnap }
  | { type: 'buzz'; teamId: string }
  | { type: 'hello' }

const ROOM_KEY = 'iq-arena-room'
const empty: ArenaSnap = {
  teams: [],
  armed: false,
  activeId: null,
  locked: [],
  round: '',
  ready: false,
}

let transport: 'local' | 'cloud' | null = null

export function emptyArena(): ArenaSnap {
  return { ...empty, teams: [], locked: [] }
}

export function makeRoomCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export function ensureRoom() {
  const saved = sessionStorage.getItem(ROOM_KEY)?.toUpperCase()
  if (saved && /^[2-9A-HJ-NP-Z]{4}$/.test(saved)) return saved
  const code = makeRoomCode()
  sessionStorage.setItem(ROOM_KEY, code)
  return code
}

export function setRoom(code: string) {
  const next = code.trim().toUpperCase()
  sessionStorage.setItem(ROOM_KEY, next)
  return next
}

export function roomFromPath(pathname = window.location.pathname) {
  const match = pathname.replace(/\/+$/, '').match(/^\/buzz\/([^/]+)$/i)
  return match?.[1]?.toUpperCase() ?? ''
}

export function buzzPath(room: string) {
  return `/buzz/${room.toUpperCase()}`
}

export function buzzUrl(room: string) {
  return `${window.location.origin}${buzzPath(room)}`
}

export function screenUrl() {
  return `${window.location.origin}/screen`
}

function topicFor(room: string) {
  return `iqarena${room.toLowerCase()}`
}

async function detectTransport() {
  if (transport) return transport
  if (import.meta.env.PROD) {
    transport = 'cloud'
    return transport
  }
  try {
    const response = await fetch('/api/arena/info', { signal: AbortSignal.timeout(900) })
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || !type.includes('application/json')) {
      transport = 'cloud'
      return transport
    }
    const info = (await response.json()) as { buzzUrls?: unknown }
    transport = Array.isArray(info.buzzUrls) ? 'local' : 'cloud'
  } catch {
    transport = 'cloud'
  }
  return transport
}

async function postLocal(body: unknown) {
  const response = await fetch('/api/arena', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('arena-local-failed')
}

async function postCloud(room: string, body: ArenaIncoming) {
  const response = await fetch(`https://ntfy.sh/${topicFor(room)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('arena-cloud-failed')
}

export async function publishArena(room: string, state: ArenaSnap) {
  const mode = await detectTransport()
  const body: ArenaIncoming = { type: 'state', state }
  if (mode === 'local') {
    try {
      await postLocal(body)
      return
    } catch {
      transport = 'cloud'
    }
  }
  await postCloud(room, body)
}

export async function sendBuzz(room: string, teamId: string) {
  const mode = await detectTransport()
  const body: ArenaIncoming = { type: 'buzz', teamId }
  if (mode === 'local') {
    try {
      await postLocal(body)
      return
    } catch {
      transport = 'cloud'
    }
  }
  await postCloud(room, body)
}

function listenLocal(onEvent: (event: ArenaIncoming) => void, onReady: () => void) {
  const source = new EventSource('/api/arena/events')
  source.onopen = () => onReady()
  source.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data) as ArenaIncoming
      if (data?.type === 'state' || data?.type === 'buzz' || data?.type === 'hello') onEvent(data)
    } catch {
      /* ignore */
    }
  }
  source.onerror = () => {
    /* browser will retry; buzz page timeout handles hard fail */
  }
  return () => source.close()
}

function listenCloud(room: string, onEvent: (event: ArenaIncoming) => void, onReady: () => void) {
  const source = new EventSource(`https://ntfy.sh/${topicFor(room)}/sse`)
  source.onopen = () => onReady()
  const onMessage = (message: MessageEvent<string>) => {
    try {
      const outer = JSON.parse(message.data) as { message?: string; event?: string }
      if (outer.event === 'open') {
        onReady()
        return
      }
      if (!outer.message) return
      const data = JSON.parse(outer.message) as ArenaIncoming
      if (data?.type === 'state' || data?.type === 'buzz' || data?.type === 'hello') onEvent(data)
    } catch {
      /* ignore */
    }
  }
  source.addEventListener('message', onMessage)
  source.addEventListener('open', () => onReady())
  return () => {
    source.removeEventListener('message', onMessage)
    source.close()
  }
}

export function listenArena(
  room: string,
  onEvent: (event: ArenaIncoming) => void,
  onReady?: () => void,
) {
  let stop = () => {}
  let active = true
  const ready = () => {
    if (active) onReady?.()
  }
  void detectTransport().then((mode) => {
    if (!active) return
    stop = mode === 'local' ? listenLocal(onEvent, ready) : listenCloud(room, onEvent, ready)
  })
  return () => {
    active = false
    stop()
  }
}

export async function arenaShareUrls(room: string) {
  const main = buzzUrl(room)
  const mode = await detectTransport()
  if (mode !== 'local') return { room, buzzUrls: [main], mode }
  try {
    const response = await fetch('/api/arena/info')
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || !type.includes('application/json')) return { room, buzzUrls: [main], mode }
    const info = (await response.json()) as { buzzUrls?: string[] }
    const lan = (info.buzzUrls ?? []).flatMap((url) => {
      try {
        const parsed = new URL(url.replace(/#.*$/, ''))
        return [`${parsed.origin}${buzzPath(room)}`]
      } catch {
        return []
      }
    })
    return { room, buzzUrls: [...new Set([main, ...lan])], mode }
  } catch {
    return { room, buzzUrls: [main], mode }
  }
}
