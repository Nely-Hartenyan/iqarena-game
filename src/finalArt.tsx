const marks = [
  { id: 'key', left: '16%', top: '24%', delay: '0s', time: '14s', node: <Key /> },
  { id: 'a', left: '78%', top: '20%', delay: '1.2s', time: '15s', node: <Glyph>A</Glyph> },
  { id: 'lock', left: '18%', top: '68%', delay: '0.5s', time: '13s', node: <MiniLock /> },
  { id: 'q', left: '80%', top: '66%', delay: '1.8s', time: '16s', node: <Glyph>?</Glyph> },
]

export function FinalArt() {
  return (
    <div className="art art-final" aria-hidden="true">
      {marks.map((mark) => (
        <span
          key={mark.id}
          className="know-mark"
          style={{ left: mark.left, top: mark.top, animationDelay: mark.delay, animationDuration: mark.time }}
        >
          {mark.node}
        </span>
      ))}
      <span className="know-glow" />
      <svg className="final-lock" viewBox="0 0 220 180">
        <defs>
          <linearGradient id="final-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e3a1" />
            <stop offset="1" stopColor="#e8b931" />
          </linearGradient>
        </defs>
        <path d="M70 82V58c0-22 18-38 40-38s40 16 40 38v24" fill="none" stroke="#f8e3a1" strokeWidth="14" strokeLinecap="round" />
        <rect x="48" y="78" width="124" height="84" rx="22" fill="url(#final-gold)" />
        <circle cx="110" cy="114" r="12" fill="#14284f" />
        <rect x="104" y="114" width="12" height="22" rx="4" fill="#14284f" />
      </svg>
    </div>
  )
}

function Glyph({ children }: { children: string }) {
  return <b>{children}</b>
}

function Key() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="18" cy="20" r="8" />
      <path d="M24 24l16 10M34 30v6M40 34v5" />
    </svg>
  )
}

function MiniLock() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M17 22v-4a7 7 0 0 1 14 0v4" />
      <rect x="14" y="22" width="20" height="14" rx="3" />
    </svg>
  )
}
