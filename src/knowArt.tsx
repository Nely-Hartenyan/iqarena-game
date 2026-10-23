const marks = [
  { id: 'atom', left: '14%', top: '18%', delay: '0s', time: '13s', node: <Atom /> },
  { id: 'letter', left: '28%', top: '68%', delay: '1.6s', time: '15s', node: <Letter /> },
  { id: 'book', left: '76%', top: '20%', delay: '0.7s', time: '12s', node: <TinyBook /> },
  { id: 'leaf', left: '82%', top: '62%', delay: '2.1s', time: '14s', node: <Leaf /> },
  { id: 'globe', left: '16%', top: '44%', delay: '0.4s', time: '16s', node: <Globe /> },
  { id: 'math', left: '80%', top: '42%', delay: '1.2s', time: '13.5s', node: <MathMark /> },
  { id: 'history', left: '40%', top: '14%', delay: '1.9s', time: '15.5s', node: <Columns /> },
  { id: 'chip', left: '64%', top: '70%', delay: '0.9s', time: '12.5s', node: <Chip /> },
]

export function KnowArt() {
  return (
    <div className="art art-know" aria-hidden="true">
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
      <svg className="know-book" viewBox="0 0 220 150">
        <defs>
          <linearGradient id="know-page" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e3a1" />
            <stop offset="1" stopColor="#e8b931" />
          </linearGradient>
        </defs>
        <path className="page" fill="url(#know-page)" d="M106 26c-10 0-28 2.4-58 10-7 1.8-12 8-12 15.2V124c0 5 4 9 9 10 26 5 46 7.2 61 7.2V26z" />
        <path className="page" fill="url(#know-page)" d="M114 26c10 0 28 2.4 58 10 7 1.8 12 8 12 15.2V124c0 5-4 9-9 10-26 5-46 7.2-61 7.2V26z" />
        <path className="line" d="M86 48H48M86 66H56M86 84H50" />
        <path className="line" d="M134 48h38M134 66h30M134 84h36" />
      </svg>
    </div>
  )
}

function Atom() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="24" cy="24" rx="15" ry="6" />
      <ellipse cx="24" cy="24" rx="15" ry="6" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="15" ry="6" transform="rotate(120 24 24)" />
      <circle className="dot" cx="24" cy="24" r="2.4" />
    </svg>
  )
}

function Letter() {
  return <b>Ա</b>
}

function TinyBook() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M8 14h13c2.2 0 4 1.4 4 3.6V36c0-2-1.8-3.2-4-3.2H8z" />
      <path d="M40 14H27c-2.2 0-4 1.4-4 3.6V36c0-2 1.8-3.2 4-3.2H40z" />
    </svg>
  )
}

function Leaf() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M14 34c7-16 22-18 24-18-2 14-11 22-24 18z" />
      <path d="M18 31c5-5 10-8 16-12" />
    </svg>
  )
}

function Globe() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="13" />
      <ellipse cx="24" cy="24" rx="5.5" ry="13" />
      <path d="M11 24h26M13 18h22M13 30h22" />
    </svg>
  )
}

function MathMark() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M16 24h16M24 16v16" />
    </svg>
  )
}

function Columns() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M12 16h24M14 16v15M24 16v15M34 16v15M12 31h24" />
    </svg>
  )
}

function Chip() {
  return (
    <svg viewBox="0 0 48 48">
      <rect x="17" y="17" width="14" height="14" rx="2" />
      <path d="M21 17v-4M24 17v-4M27 17v-4M21 35v-4M24 35v-4M27 35v-4M17 21h-4M17 24h-4M17 27h-4M35 21h-4M35 24h-4M35 27h-4" />
    </svg>
  )
}
