const marks = [
  { id: 'film', left: '16%', top: '26%', delay: '0s', time: '14s', node: <Film /> },
  { id: 'city', left: '78%', top: '22%', delay: '1.1s', time: '15s', node: <City /> },
  { id: 'cartoon', left: '18%', top: '68%', delay: '0.6s', time: '13s', node: <Cartoon /> },
  { id: 'person', left: '80%', top: '64%', delay: '1.7s', time: '16s', node: <Person /> },
]

export function GuessArt() {
  return (
    <div className="art art-guess" aria-hidden="true">
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
      <svg className="guess-frame" viewBox="0 0 220 160">
        <defs>
          <linearGradient id="guess-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e3a1" />
            <stop offset="1" stopColor="#e8b931" />
          </linearGradient>
        </defs>
        <rect x="18" y="16" width="184" height="128" rx="22" fill="url(#guess-card)" />
        <rect x="34" y="32" width="152" height="86" rx="12" fill="#14284f" />
        <path d="M48 96c18-22 32-22 48-6 10 10 22 8 34-10 8 16 22 22 40 22H48z" fill="#e8b931" opacity="0.9" />
        <circle cx="78" cy="58" r="10" fill="#f8e3a1" />
      </svg>
    </div>
  )
}

function Film() {
  return (
    <svg viewBox="0 0 48 48">
      <rect x="10" y="14" width="28" height="20" rx="3" />
      <path d="M16 14v20M22 14v20M28 14v20M34 14v20M10 20h28M10 28h28" />
    </svg>
  )
}

function City() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M12 36V20h8v16M20 36V14h10v22M30 36V22h8v14M10 36h30" />
    </svg>
  )
}

function Cartoon() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="12" />
      <path d="M18 22h.01M30 22h.01M18 28c2 3 10 3 12 0" />
    </svg>
  )
}

function Person() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="18" r="6" />
      <path d="M14 36c1.5-7 18.5-7 20 0" />
    </svg>
  )
}
