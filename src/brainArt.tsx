export type BrainKind = 'numbers' | 'riddle' | 'picture' | 'matches'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const SHAPES = ['circle', 'square', 'diamond', 'triangle', 'circle', 'square', 'diamond', 'triangle']

export function BrainArt({ kind, compact = false }: { kind: BrainKind; compact?: boolean }) {
  return (
    <div className={`art art-${kind}${compact ? ' is-compact' : ''}`} aria-hidden="true">
      {kind === 'numbers' && <NumbersArt compact={compact} />}
      {kind === 'riddle' && <RiddleArt compact={compact} />}
      {kind === 'picture' && <PictureArt compact={compact} />}
      {kind === 'matches' && <MatchesArt compact={compact} />}
    </div>
  )
}

function NumbersArt({ compact }: { compact: boolean }) {
  const digits = compact ? ['1', '4', '7', '9'] : DIGITS
  return (
    <>
      <div className="num-orbit">
        {digits.map((digit, index) => (
          <span key={digit} style={{ ['--i' as string]: compact ? index * 2.5 : index }}>
            <em>
              <b>{digit}</b>
            </em>
          </span>
        ))}
      </div>
      <div className="num-core">?</div>
    </>
  )
}

function RiddleArt({ compact }: { compact: boolean }) {
  return (
    <>
      <span className="ring" />
      {!compact && <span className="ring ring-late" />}
      <svg viewBox="0 0 120 160">
        <path className="q-stroke" pathLength="100" d="M38 58c0-24 44-28 44 2 0 22-22 24-22 42" />
        <circle className="q-dot" cx="60" cy="128" r="6" />
      </svg>
    </>
  )
}

function PictureArt({ compact }: { compact: boolean }) {
  const shapes = compact ? SHAPES.slice(0, 3) : SHAPES
  return (
    <div className="pic-grid">
      {shapes.map((shape, index) => (
        <i key={`${shape}-${index}`} className={shape} style={{ animationDelay: `${index * 0.16}s` }} />
      ))}
      <i className="missing" style={{ animationDelay: `${shapes.length * 0.16}s` }}>?</i>
    </div>
  )
}

function MatchStick() {
  return (
    <g className="match">
      <line x1="6" y1="0" x2="72" y2="0" />
      <circle cx="78" cy="0" r="6.5" />
    </g>
  )
}

function MatchesArt({ compact }: { compact: boolean }) {
  return (
    <svg viewBox={compact ? '0 0 140 140' : '0 0 280 170'}>
      <g transform={compact ? 'translate(18,34)' : 'translate(28,48)'}>
        <MatchStick />
      </g>
      <g transform={compact ? 'translate(18,104)' : 'translate(28,122)'}>
        <MatchStick />
      </g>
      <g transform={compact ? 'translate(34,34) rotate(90)' : 'translate(46,48) rotate(90)'}>
        <MatchStick />
      </g>
      <g className="match-slide">
        <MatchStick />
      </g>
    </svg>
  )
}
