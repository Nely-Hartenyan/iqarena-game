type Team = { id: string; name: string; score: number }

function Trophy() {
  return (
    <svg className="trophy" viewBox="0 0 240 188" aria-hidden="true">
      <path d="M92 28h56l-6 16H98z" fill="#f8e3a1" />
      <path d="M104 8l10 20h-20zM120 2l10 26h-20zM136 8l10 20h-20z" fill="#e8b931" />
      <circle cx="104" cy="14" r="4" fill="#f8e3a1" />
      <circle cx="120" cy="8" r="4" fill="#f8e3a1" />
      <circle cx="136" cy="14" r="4" fill="#f8e3a1" />
      <path d="M68 48h104c0 46-20 78-52 78S68 94 68 48z" fill="#e8b931" />
      <path d="M86 48h68c0 32-12 54-34 54s-34-22-34-54z" fill="#f0c14a" />
      <path d="M68 66c-26 2-34 28-18 40 12 8 30 0 34-16" fill="none" stroke="#e8b931" strokeWidth="10" strokeLinecap="round" />
      <path d="M172 66c26 2 34 28 18 40-12 8-30 0-34-16" fill="none" stroke="#e8b931" strokeWidth="10" strokeLinecap="round" />
      <rect x="108" y="124" width="24" height="24" rx="3" fill="#c49212" />
      <rect x="74" y="146" width="92" height="16" rx="4" fill="#f8e3a1" />
    </svg>
  )
}

function rankOf(teams: Team[], index: number) {
  const score = teams[index]?.score
  const first = teams.findIndex((team) => team.score === score)
  return first + 1
}

export function WinnerBoard({ teams, winners }: { teams: Team[]; winners: string[] }) {
  const ranked = teams
    .filter((team) => team.name.trim())
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'hy'))
  const winnerNames = winners.filter(Boolean)
  const title = winnerNames.join(' · ')

  return (
    <div className="finale">
      <section className="finale-hero">
        <i className="spark spark-a" />
        <i className="spark spark-b" />
        <i className="spark spark-c" />
        <i className="spark spark-d" />
        <h1>WINNER</h1>
        <Trophy />
        <div className="podium" aria-hidden="true">
          <span className="podium-side">2</span>
          <span className="podium-main">1</span>
          <span className="podium-side podium-low">3</span>
        </div>
        <p className="finale-banner">{title}</p>
        <p className="finale-year">IQ ARENA 2026</p>
      </section>
      <aside className="finale-results">
        <h2>FINAL RESULTS</h2>
        <ol>
          {ranked.map((team, index) => (
            <li key={team.id} className={winnerNames.includes(team.name) ? 'is-first' : ''}>
              <b>{rankOf(ranked, index)}</b>
              <span>{team.name}</span>
              <strong>{team.score} <small>pts</small></strong>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
