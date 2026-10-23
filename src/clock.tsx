import { useEffect, useState } from 'react'

export function leftSeconds(endsAt: number | null, now: number) {
  if (!endsAt) return null
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

export function Clock({ endsAt, big = false }: { endsAt: number | null; big?: boolean }) {
  const now = useNow(endsAt != null)
  const left = leftSeconds(endsAt, now)
  const label = left == null ? '—' : formatClock(left)
  return <span className={big ? 'clock clock-big' : 'clock' + (left != null && left <= 5 ? ' clock-hot' : '')}>{label}</span>
}
