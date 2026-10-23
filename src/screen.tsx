import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BrainArt, type BrainKind } from './brainArt'
import { KnowArt } from './knowArt'
import { GuessArt } from './guessArt'
import { FinalArt } from './finalArt'
import { BuzzerArt } from './buzzerArt'
import { TallyArt } from './tallyArt'
import { WinnerBoard } from './winnerArt'
import { Clock, leftSeconds, useNow } from './clock'

export type ScreenTeam = { id: string; name: string; score: number }

export type ScreenBoard = { title: string; cells: { points: number; taken: boolean; missing: boolean }[] }

export type ScreenView = {
  teams: ScreenTeam[]
  round: string
  timerEndsAt: number | null
  buzzName: string | null
  buzzEndsAt: number | null
  armed: boolean
  kind: 'idle' | 'wait' | 'lineup' | 'know' | 'guess' | 'brain' | 'buzzer' | 'final'
  title: string
  text: string
  image: string | null
  answerImage: string | null
  answer: string | null
  emoji: string | null
  points: number | null
  board: ScreenBoard[] | null
  tasks: { prompt: string; letters: string }[] | null
  hints: string[] | null
  subjects: { title: string; active: boolean; taken?: boolean; team?: string | null }[] | null
  topics: { id: string; title: string; seconds: number; taken: boolean }[] | null
  sample: boolean
  award: { name: string; points: number } | null
  done: boolean
  ordered: boolean
  stageScores: { name: string; points: number }[] | null
  winner: string[] | null
  tally: boolean
}

const CHANNEL = 'iq-arena-game'
const STORAGE = 'iq-arena-screen'

const facts = [
  ['16', 'մասնակից թիմ'],
  ['4', 'թիմ յուրաքանչյուր խաղում'],
  ['5', 'մրցութային փուլ'],
  ['1', 'եզրափակչի հաղթող'],
]

const stages = ['Know It All', 'Guess It', 'Brain Battle', 'Buzzer Rush', 'Final Code']

export function ShuffleLineup({ teams, ordered }: { teams: { id: string; name: string }[]; ordered: boolean }) {
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const positions = useRef<Record<string, DOMRect>>({})

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next: Record<string, DOMRect> = {}
    teams.forEach((team) => {
      const el = itemRefs.current[team.id]
      if (!el) return
      const rect = el.getBoundingClientRect()
      const prev = positions.current[team.id]
      if (!reduce && prev) {
        const dx = prev.left - rect.left
        const dy = prev.top - rect.top
        if (dx || dy) {
          const tilt = Math.max(-3.5, Math.min(3.5, dx / 90))
          el.style.zIndex = '3'
          el.getAnimations().forEach((anim) => anim.cancel())
          const anim = el.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) rotate(${tilt}deg) scale(1)`,
                boxShadow: '0 8px 18px -16px rgba(232, 185, 49, 0.2)',
                easing: 'cubic-bezier(0.4, 0, 0.15, 1)',
              },
              {
                transform: `translate(${dx * 0.38}px, ${dy * 0.38 - 26}px) rotate(${tilt * 0.35}deg) scale(1.035)`,
                boxShadow: '0 22px 36px -18px rgba(232, 185, 49, 0.55)',
                offset: 0.46,
              },
              {
                transform: 'translate(0, 0) rotate(0deg) scale(1)',
                boxShadow: '0 8px 18px -16px rgba(232, 185, 49, 0.15)',
              },
            ],
            { duration: 820, easing: 'linear' },
          )
          anim.onfinish = () => {
            el.style.zIndex = ''
          }
        }
      }
      next[team.id] = rect
    })
    positions.current = next
  }, [teams])

  return (
    <ol className={ordered ? 'lineup' : 'lineup is-plain'}>
      {teams.map((team, index) => (
        <li key={team.id} ref={(node) => { itemRefs.current[team.id] = node }}>
          {ordered && <span>0{index + 1}</span>}
          <strong>{team.name}</strong>
        </li>
      ))}
    </ol>
  )
}

function Stage({ children, lineup = false }: { children: ReactNode; lineup?: boolean }) {
  return (
    <main className="screen idle-screen">
      <div className="idle-glow" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="idle-main">
        {!lineup && <p className="kicker">Intellectual Championship</p>}
        <img className="wordmark" src="/brand/wordmark.png" alt="IQ ARENA" />
        {children}
        {!lineup && (
          <>
            <ul className="stage-list">
              {stages.map((stage, index) => (
                <li key={stage}>
                  <span>0{index + 1}</span>
                  {stage}
                </li>
              ))}
            </ul>
            <ul className="stats">
              {facts.map(([value, label]) => (
                <li key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="site-footer">
        <p className="organized">
          <img src="/brand/eca.png" alt="" />
          Organized by AI Department
        </p>
      </footer>
    </main>
  )
}

function StageTitle({ title }: { title: string }) {
  const [first, ...rest] = title.split(' ')
  return (
    <>
      {first}
      {rest.length > 0 && (
        <>
          <br />
          <span>{rest.join(' ')}</span>
        </>
      )}
    </>
  )
}

function BrainQuestion({ view }: { view: ScreenView }) {
  const shown = view.answer != null || Boolean(view.answerImage && view.answer === '')
  const image = view.answer === '' && view.answerImage ? view.answerImage : view.image
  return (
    <div className="prompt brain-question">
      <Clock endsAt={view.timerEndsAt} big />
      {view.title && <p className="kicker">{view.title}</p>}
      {view.text && <h1>{view.text}</h1>}
      {image && <img src={image} alt="" />}
      {shown && (
        <p className="brain-answer">
          <span>Պատասխան</span>
          {view.answer ? <strong>{view.answer}</strong> : null}
        </p>
      )}
    </div>
  )
}

function KnowMoment({ view }: { view: ScreenView }) {
  const now = useNow(view.timerEndsAt != null)
  const left = leftSeconds(view.timerEndsAt, now)
  if (left === 0 && view.award) {
    return (
      <div className="prompt result">
        <p className="kicker">{view.title}</p>
        <h1>{view.award.name}</h1>
        <p className="result-score">
          <strong>{view.award.points}</strong>
          <span>միավոր</span>
        </p>
      </div>
    )
  }
  return (
    <div className="prompt know-prompt">
      <Clock endsAt={view.timerEndsAt} big />
      {view.title && <p className="kicker">{view.title}</p>}
      {view.text && <h1>{view.text}</h1>}
    </div>
  )
}

export function publish(view: ScreenView) {
  localStorage.setItem(STORAGE, JSON.stringify(view))
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage(view)
  channel.close()
}

export function Screen() {
  const [view, setView] = useState<ScreenView | null>(null)
  const now = useNow(view?.timerEndsAt != null)
  const finalLeft = leftSeconds(view?.timerEndsAt ?? null, now)
  const finalQuestionsOpen = view?.kind === 'final' && !!view.tasks && finalLeft !== 0
  const finalHintsOpen = view?.kind === 'final' && !!view.hints
  const finalHold = view?.kind === 'final' && !view.done && !finalQuestionsOpen && !finalHintsOpen

  useEffect(() => {
    const read = () => {
      const saved = localStorage.getItem(STORAGE)
      if (saved) setView(JSON.parse(saved) as ScreenView)
    }
    read()
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event) => setView(event.data as ScreenView)
    window.addEventListener('storage', read)
    return () => {
      channel.close()
      window.removeEventListener('storage', read)
    }
  }, [])

  if (!view || view.kind === 'wait' || view.teams.length === 0) {
    return (
      <Stage>
        <h1>Այստեղ հաղթում է միտքը</h1>
        <p className="lead">Գիտելիք, տրամաբանություն և արագություն՝ մեկ թիմային մրցույթում։</p>
      </Stage>
    )
  }

  if (view.kind === 'lineup') {
    return (
      <main className="screen idle-screen">
        <div className="idle-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <header className="lineup-top">
          <img className="wordmark" src="/brand/wordmark.png" alt="IQ ARENA" />
        </header>
        <div className="idle-main">
          <h1>Մեր այսօրվա թիմերը</h1>
          <ShuffleLineup teams={view.teams} ordered={view.ordered} />
        </div>
        <footer className="site-footer">
          <p className="organized">
            <img src="/brand/eca.png" alt="" />
            Organized by AI Department
          </p>
        </footer>
      </main>
    )
  }

  return (
    <main className="screen">
      <header className="screen-top">
        <img className="wordmark wordmark-sm" src="/brand/wordmark.png" alt="IQ ARENA" />
        <p className="round-name">{view.tally || view.winner?.length ? '' : view.round}</p>
        <span className="screen-balance" />
        <div className="score-line">
          {(view.kind === 'guess' ? view.buzzEndsAt : view.timerEndsAt) && view.kind !== 'know' && view.kind !== 'brain' && !finalHold && (
            <div className="screen-clock">
              <Clock endsAt={view.kind === 'guess' ? view.buzzEndsAt : view.timerEndsAt} big />
            </div>
          )}
        </div>
      </header>

      {view.buzzName && (
        <div className="buzz-banner">
          <span>{view.buzzName}</span>
          <Clock endsAt={view.buzzEndsAt} big />
        </div>
      )}

      <section className="screen-body">
        {view.winner && view.winner.length > 0 && (
          <WinnerBoard teams={view.teams} winners={view.winner} />
        )}
        {view.tally && !view.winner?.length && (
          <div className="stage-done tally-scene">
            <TallyArt />
            <h1>
              <StageTitle title={view.title} />
            </h1>
            <span className="stage-done-line" aria-hidden="true" />
            {view.text && <p className="onward">{view.text}</p>}
          </div>
        )}
        {view.stageScores && view.stageScores.length > 0 && !view.tally && !view.winner?.length && (
          <div className="stage-scores">
            <p className="kicker">Այս փուլի միավորները</p>
            <ol>
              {view.stageScores.map((row) => (
                <li key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.points > 0 ? `+${row.points}` : row.points}</strong>
                </li>
              ))}
            </ol>
          </div>
        )}
        {view.done && !view.tally && !view.stageScores?.length && !view.winner?.length && (
          <div className="stage-done">
            <div className="stage-done-glow" aria-hidden="true" />
            <h1>
              <StageTitle title={view.title} />
            </h1>
            <span className="stage-done-line" aria-hidden="true" />
            {view.text && <p className="onward">{view.text}</p>}
          </div>
        )}
        {view.subjects && !view.done && (
          <div className="know-wrap">
            {view.title && <h1 className="wait-title know-title">{view.title}</h1>}
            <div className="know-board">
              {view.subjects.map((subject) => (
                <article key={subject.title} className={subject.taken ? 'taken' : subject.active ? 'on' : ''}>
                  <h2>{subject.title}</h2>
                  {subject.taken && <p>վերցված է</p>}
                </article>
              ))}
            </div>
          </div>
        )}
        {view.topics && !view.done && (
          <div className="know-wrap">
            <div className="brain-board">
              {view.topics.map((topic, index) => (
                <article key={topic.id} className={topic.taken ? 'taken' : ''} style={{ animationDelay: `${index * 0.08}s` }}>
                  <span className="brain-index">0{index + 1}</span>
                  <BrainArt kind={topic.id as BrainKind} compact />
                  <h2>{topic.title}</h2>
                  <p className="brain-time">
                    <b>{topic.seconds}</b>
                    <span>վայրկյան</span>
                  </p>
                  {topic.taken && <p>ավարտված է</p>}
                </article>
              ))}
            </div>
          </div>
        )}
        {view.sample && view.kind === 'know' && !view.done && (
          <div className="brain-scene know-scene">
            <KnowArt />
          </div>
        )}
        {view.sample && view.kind === 'guess' && !view.done && (
          <div className="brain-scene guess-scene">
            <GuessArt />
          </div>
        )}
        {view.sample && view.kind !== 'know' && view.kind !== 'guess' && view.kind !== 'buzzer' && view.kind !== 'final' && !view.done && (
          <div className="brain-scene">
            <BrainArt kind={(view.emoji || 'numbers') as BrainKind} />
            <h1>{view.title}</h1>
          </div>
        )}
        {view.kind === 'buzzer' && view.sample && !view.done && (
          <div className="buzzer-wait">
            <BuzzerArt />
          </div>
        )}
        {finalHold && (
          <div className="brain-scene final-scene">
            <FinalArt />
          </div>
        )}
        {view.kind === 'brain' && !view.done && !view.topics && !view.sample && <BrainQuestion view={view} />}
        {view.board && !view.done && !view.winner?.length && !view.tally && (
          <div className="guess-board">
            {view.board.map((column) => (
              <article key={column.title}>
                <h2>{column.title}</h2>
                {column.cells.map((cell) => (
                  <p key={cell.points} className={cell.missing ? 'missing' : cell.taken ? 'taken' : ''}>
                    <b>{cell.points}</b>
                    <span>{cell.missing ? 'չկա' : cell.taken ? 'վերցված է' : 'միավոր'}</span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
        {!view.board && !view.subjects && view.kind === 'idle' && <h1 className="wait-title">{view.title || 'IQ ARENA'}</h1>}
        {view.kind === 'know' && !view.subjects && !view.sample && !view.done && <KnowMoment view={view} />}
        {view.kind !== 'idle' && view.kind !== 'know' && view.kind !== 'brain' && !view.done && !view.board && !view.subjects && !view.sample && !finalHold && (
          <div className={view.kind === 'guess' ? 'prompt guess-prompt' : view.kind === 'buzzer' ? 'prompt buzzer-prompt' : view.kind === 'final' ? 'prompt final-prompt' : 'prompt'}>
            {view.kind !== 'guess' && view.points != null && <p className="points">{view.points} միավոր</p>}
            {view.title && <p className="kicker">{view.title}</p>}
            {view.kind === 'guess' && view.text && <h1>{view.text}</h1>}
            {view.emoji && <p className="emoji">{view.emoji}</p>}
            {view.image && <img src={view.image} alt="" />}
            {view.kind === 'guess' && view.points != null && <p className="points">{view.points} միավոր</p>}
            {view.kind !== 'guess' && view.text && <h1>{view.text}</h1>}
            {view.tasks && finalQuestionsOpen && (
              <ol className="final-tasks">
                {view.tasks.map((task, index) => (
                  <li key={index}>
                    <span>{index + 1}</span>
                    <div>
                      <p>{task.prompt}</p>
                      {task.letters && <strong>{task.letters}</strong>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {view.hints && (
              <ul className="hints">
                {view.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
