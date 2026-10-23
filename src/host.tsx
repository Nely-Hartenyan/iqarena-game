import { useEffect, useMemo, useReducer } from 'react'
import { Clock, leftSeconds, useNow } from './clock'
import { pack, type BrainTask, type FinalSet } from './pack'
import { publish, ShuffleLineup, type ScreenView } from './screen'

type Team = { id: string; name: string; key: string; score: number }
type Buzz = { armed: boolean; activeId: string | null; deadline: number | null; locked: string[] }
type RoundId = 'know' | 'guess' | 'brain' | 'buzzer' | 'final'

type State = {
  teams: Team[]
  namesSaved: boolean
  ordered: boolean
  shuffling: boolean
  shuffleTicks: number
  shuffleFinal: Team[] | null
  round: RoundId
  listening: number | null
  know: {
    teamId: string | null
    categoryId: string | null
    index: number
    endsAt: number | null
    gained: number
    picks: Record<string, string[]>
    shown: boolean
    opened: boolean
  }
  guess: { currentId: string | null; used: string[]; buzz: Buzz; shown: boolean }
  brain: { groupId: string | null; revealed: boolean; endsAt: number | null; done: string[]; played: string[]; answerOn: boolean }
  buzzer: { categoryId: string; index: number; visible: boolean; buzz: Buzz; seen: string[] }
  final: {
    setId: string
    phase: 'idle' | 'tasks' | 'hints' | 'word'
    endsAt: number | null
    checks: Record<string, boolean[]>
    applied: boolean
  }
  game: number
  knowStarts: number[]
  stageBase: Partial<Record<RoundId, Record<string, number>>>
  reveal: null | 'scores' | 'winner'
}

const emptyBuzz = (): Buzz => ({ armed: false, activeId: null, deadline: null, locked: [] })
const GAMES = [1, 2, 3, 4, 5]
const STARTS_KEY = 'iq-arena-know-starts'
const DEFAULT_STARTS = [0, 9, 19, 29, 39]
const BUZZER_PER_GAME = 2

function loadStarts(): number[] {
  try {
    const raw = localStorage.getItem(STARTS_KEY)
    const parsed = raw ? JSON.parse(raw) as unknown : null
    if (Array.isArray(parsed) && parsed.length === GAMES.length) {
      const saved = parsed.map((value) => Math.max(0, Math.floor(Number(value)) || 0))
      if (saved.every((value) => value === 0)) return DEFAULT_STARTS
      return saved
    }
  } catch {
    /* keep the default starts */
  }
  return DEFAULT_STARTS
}

function gameNumber(value: number) {
  return GAMES.includes(value) ? value : 1
}

function knowLast() {
  return Math.max(...pack.know.map((item) => item.questions.length)) - 1
}

function buzzerList(game: number) {
  const start = (gameNumber(game) - 1) * BUZZER_PER_GAME
  const cards = pack.buzzer.flatMap((category) => category.questions.slice(start, start + BUZZER_PER_GAME))
  const next = [...cards]
  let seed = gameNumber(game) * 9973 + 17
  for (let index = next.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const swap = Math.floor((seed / 0x100000000) * (index + 1))
    const card = next[index]
    next[index] = next[swap]
    next[swap] = card
  }
  return next
}

function finalSetId(game: number) {
  return pack.final[gameNumber(game) - 1]?.id ?? pack.final[0].id
}

const fresh = (): State => ({
  teams: [0, 1, 2, 3].map((i) => ({ id: `t${i + 1}`, name: '', key: '', score: 0 })),
  namesSaved: false,
  ordered: false,
  shuffling: false,
  shuffleTicks: 0,
  shuffleFinal: null,
  round: 'know',
  listening: null,
  know: { teamId: null, categoryId: null, index: 0, endsAt: null, gained: 0, picks: {}, shown: false, opened: false },
  guess: { currentId: null, used: [], buzz: emptyBuzz(), shown: false },
  brain: { groupId: null, revealed: false, endsAt: null, done: [], played: [], answerOn: false },
  buzzer: { categoryId: pack.buzzer[0].id, index: 0, visible: false, buzz: emptyBuzz(), seen: [] },
  final: { setId: pack.final[0].id, phase: 'idle', endsAt: null, checks: {}, applied: false },
  game: 1,
  knowStarts: loadStarts(),
  stageBase: { know: { t1: 0, t2: 0, t3: 0, t4: 0 } },
  reveal: null,
})

type Action =
  | { type: 'replace'; state: State }
  | { type: 'team'; index: number; name: string }
  | { type: 'save-names' }
  | { type: 'order-teams' }
  | { type: 'order-tick' }
  | { type: 'order-finish' }
  | { type: 'know-open' }
  | { type: 'listen'; index: number | null }
  | { type: 'bind'; index: number; key: string }
  | { type: 'score'; id: string; delta: number }
  | { type: 'round'; round: RoundId }
  | { type: 'know-show' }
  | { type: 'know-team'; id: string }
  | { type: 'know-category'; id: string }
  | { type: 'know-mark'; right: boolean }
  | { type: 'know-close' }
  | { type: 'guess-show' }
  | { type: 'guess-open'; id: string }
  | { type: 'guess-right'; id: string }
  | { type: 'guess-wrong' }
  | { type: 'guess-close' }
  | { type: 'brain-pick'; id: string }
  | { type: 'brain-start' }
  | { type: 'brain-close' }
  | { type: 'brain-answer' }
  | { type: 'brain-mark'; id: string; right: boolean }
  | { type: 'buzzer-show' }
  | { type: 'buzzer-right'; id: string }
  | { type: 'buzzer-wrong'; id: string }
  | { type: 'buzzer-next' }
  | { type: 'final-set'; id: string }
  | { type: 'final-tasks' }
  | { type: 'final-hints' }
  | { type: 'final-ready' }
  | { type: 'final-word' }
  | { type: 'final-check'; id: string; index: number }
  | { type: 'final-apply' }
  | { type: 'reveal-scores' }
  | { type: 'reveal-winner' }
  | { type: 'buzz'; id: string }
  | { type: 'buzz-timeout' }
  | { type: 'set-game'; game: number }
  | { type: 'know-start'; value: number }
  | { type: 'reset' }

const HOST_KEY = 'iq-arena-host-v1'
const POINTS = [2, 4, 6]
const GUESS_ORDER = ['films', 'cities', 'emoji', 'people']
const GUESS_LABEL: Record<string, string> = {
  films: 'Ֆիլմ',
  cities: 'Քաղաք',
  emoji: 'Մուլտ',
  people: 'Հայտնի մարդ',
}
const GUESS_QUESTION: Record<string, string> = {
  films: 'Ո՞ր ֆիլմից է հետևյալ կադրը',
  cities: 'Ո՞ր քաղաքն է պատկերված',
  people: 'Ո՞ր հայտնի մարդն է պատկերված',
  emoji: 'Ո՞ր մուլտֆիլմն են նկարագրում էմոջիները',
}

const BRAIN_TYPES = [
  {
    id: 'numbers',
    title: 'Թվային օրինաչափություններ',
    group: 'Թվեր',
    how: 'Էկրանին թվերի շարք կլինի։ Թիմերը գտնում են կանոնը և գրում հաջորդ թիվը։ Ժամանակը 30 վայրկյան է։',
  },
  {
    id: 'riddle',
    title: 'Տրամաբանական հանելուկներ',
    group: 'Հանելուկ',
    how: 'Մեկ հանելուկ է։ Պատասխանը կարճ են գրում։ Ժամանակը 45 վայրկյան է։',
  },
  {
    id: 'picture',
    title: 'Տեսողական օրինաչափություններ',
    group: 'Նկար',
    how: 'Նկարում օրինաչափություն է, մի վանդակ դատարկ է, ներքևում՝ տարբերակներ։ Պետք է գրել ճիշտ տարբերակի համարը։ Ժամանակը 30 վայրկյան է։',
  },
  {
    id: 'matches',
    title: 'Մաթեմատիկական գլուխկոտրուկներ',
    group: 'Լուցկի',
    how: 'Հավասարումը լուցկիներով է և սխալ է։ Պետք է տեղափոխել լուցկիները, որ այն ճիշտ դառնա։ Ժամանակը 45 վայրկյան է։ Պատասխանը երկրորդ նկարն է. բացիր այն կոճակով։',
  },
]

function brainType(id: string | null) {
  return BRAIN_TYPES.find((item) => item.id === id) ?? null
}

function brainSlice(id: string | null, game: number) {
  const type = brainType(id)
  if (!type) return null
  const items = pack.brain.filter((item) => item.group === type.group)
  const index = type.id === 'matches' ? (gameNumber(game) - 1) * 2 : gameNumber(game) - 1
  const task = items[index]
  if (!task) return null
  return { task, answerImage: type.id === 'matches' ? items[index + 1]?.image ?? null : null }
}

function guessColumns() {
  return GUESS_ORDER.flatMap((id) => {
    const column = pack.guess.find((item) => item.id === id)
    return column ? [column] : []
  })
}

function guessCell(items: { id: string; points: number }[], points: number, game: number) {
  return items.filter((item) => item.points === points)[gameNumber(game) - 1] ?? null
}

function guessComplete(used: string[], game: number) {
  return guessColumns().every((column) => POINTS.every((points) => {
    const item = guessCell(column.items, points, game)
    return !item || used.includes(item.id)
  }))
}

const NEXT_ROUND: Record<RoundId, RoundId | null> = {
  know: 'guess',
  guess: 'brain',
  brain: 'buzzer',
  buzzer: 'final',
  final: null,
}

function scoreMap(teams: Team[]) {
  return Object.fromEntries(teams.map((team) => [team.id, team.score]))
}

function withStageBase(state: State, round: RoundId): State {
  if (state.stageBase[round]) return state
  return { ...state, stageBase: { ...state.stageBase, [round]: scoreMap(state.teams) } }
}

function stagePoints(state: State) {
  const base = state.stageBase[state.round] ?? {}
  return state.teams
    .filter((team) => team.name.trim())
    .map((team) => ({ name: team.name.trim(), points: team.score - (base[team.id] ?? team.score) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'hy'))
}

function winnerNames(state: State) {
  const named = state.teams.filter((team) => team.name.trim())
  const best = Math.max(...named.map((team) => team.score))
  return named.filter((team) => team.score === best).map((team) => team.name.trim())
}

function finishedScreen(kind: ScreenView['kind']) {
  return {
    kind,
    done: true,
    tally: false,
    winner: null,
    stageScores: null,
    timerEndsAt: null,
    tasks: null,
    hints: null,
    sample: false,
    board: null,
    subjects: null,
    topics: null,
    title: 'Փուլն ավարտված է',
    text: 'Անցնում ենք առաջ',
  }
}

function endScreen(state: State, kind: ScreenView['kind']) {
  const done = finishedScreen(kind)
  if (state.reveal !== 'scores') return done
  return { ...done, stageScores: stagePoints(state) }
}

function knowOwner(picks: Record<string, string[]>, categoryId: string) {
  return Object.entries(picks).find(([, ids]) => ids.includes(categoryId))?.[0] ?? null
}

function knowComplete(picks: Record<string, string[]>, teams: { id: string }[]) {
  return teams.length > 0 && teams.every((team) => (picks[team.id] ?? []).length >= 2)
}

function knowPicksNow(picks: Record<string, string[]>, teamId: string | null, categoryId: string | null) {
  if (!teamId || !categoryId) return picks
  return { ...picks, [teamId]: (picks[teamId] ?? []).filter((id) => id !== categoryId) }
}

function nextKnowTeam(teams: Team[], picks: Record<string, string[]>) {
  if (knowComplete(picks, teams)) return null
  const circle = teams.every((team) => (picks[team.id] ?? []).length >= 1) ? 1 : 0
  return teams.find((team) => (picks[team.id] ?? []).length === circle) ?? null
}

function knowCircle(teams: Team[], picks: Record<string, string[]>) {
  return teams.some((team) => (picks[team.id] ?? []).length === 0) ? 1 : 2
}

function add(teams: Team[], id: string, delta: number) {
  return teams.map((team) => (team.id === id ? { ...team, score: team.score + delta } : team))
}

function activeBuzz(state: State): Buzz | null {
  if (state.round === 'guess' && state.guess.currentId) return state.guess.buzz
  if (state.round === 'buzzer' && state.buzzer.visible) return state.buzzer.buzz
  return null
}

function withBuzz(state: State, buzz: Buzz): State {
  if (state.round === 'guess') return { ...state, guess: { ...state.guess, buzz } }
  if (state.round === 'buzzer') return { ...state, buzzer: { ...state.buzzer, buzz } }
  return state
}

function lockActive(state: State, delta: number): State {
  const buzz = activeBuzz(state)
  if (!buzz?.activeId) return state
  const locked = buzz.locked.includes(buzz.activeId) ? buzz.locked : [...buzz.locked, buzz.activeId]
  const teams = delta ? add(state.teams, buzz.activeId, delta) : state.teams
  const armed = locked.length < teams.length
  const deadline = state.round === 'guess' && armed ? Date.now() + 5000 : null
  return withBuzz({ ...state, teams }, { armed, activeId: null, deadline, locked })
}

function shuffleTeams(teams: Team[]) {
  const next = [...teams]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  const same = next.every((team, index) => team.id === teams[index].id)
  if (same && next.length > 1) {
    const swap = next[0]
    next[0] = next[1]
    next[1] = swap
  }
  return next
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'team': {
      const teams = state.teams.map((team, index) => (index === action.index ? { ...team, name: action.name } : team))
      return {
        ...state,
        teams,
        namesSaved: false,
        ordered: false,
        shuffling: false,
        shuffleTicks: 0,
        shuffleFinal: null,
        know: { ...state.know, shown: false, opened: false },
      }
    }
    case 'save-names': {
      if (!state.teams.every((team) => team.name.trim())) return state
      return {
        ...state,
        namesSaved: true,
        ordered: false,
        shuffling: false,
        shuffleTicks: 0,
        shuffleFinal: null,
        know: { teamId: null, categoryId: null, index: 0, endsAt: null, gained: 0, picks: {}, shown: false, opened: false },
      }
    }
    case 'order-teams': {
      if (!state.namesSaved || state.ordered || state.shuffling) return state
      return { ...state, shuffling: true, shuffleTicks: 0, shuffleFinal: shuffleTeams(state.teams) }
    }
    case 'order-tick':
      if (!state.shuffling) return state
      return { ...state, teams: shuffleTeams(state.teams), shuffleTicks: state.shuffleTicks + 1 }
    case 'order-finish':
      if (!state.shuffleFinal) return { ...state, shuffling: false, shuffleTicks: 0 }
      return { ...state, teams: state.shuffleFinal, ordered: true, shuffling: false, shuffleTicks: 0, shuffleFinal: null }
    case 'know-open':
      return { ...state, round: 'know', know: { ...state.know, opened: true } }
    case 'listen':
      return { ...state, listening: action.index }
    case 'bind': {
      const teams = state.teams.map((team, index) => {
        if (index === action.index) return { ...team, key: action.key }
        if (team.key === action.key) return { ...team, key: '' }
        return team
      })
      return { ...state, teams, listening: null }
    }
    case 'score':
      return { ...state, teams: add(state.teams, action.id, action.delta) }
    case 'round':
      return withStageBase({ ...state, round: action.round, reveal: null }, action.round)
    case 'know-show':
      return { ...state, know: { ...state.know, shown: true, teamId: nextKnowTeam(state.teams, state.know.picks)?.id ?? state.teams[0]?.id ?? null } }
    case 'know-team':
      return state
    case 'know-category': {
      if (state.know.endsAt != null || knowOwner(state.know.picks, action.id)) return state
      const team = nextKnowTeam(state.teams, state.know.picks)
      if (!team) return state
      const picks = {
        ...state.know.picks,
        [team.id]: Array.from(new Set([...(state.know.picks[team.id] ?? []), action.id])),
      }
      const start = state.knowStarts[gameNumber(state.game) - 1] ?? 0
      const category = pack.know.find((item) => item.id === action.id)
      const index = Math.min(start, Math.max((category?.questions.length ?? 1) - 1, 0))
      return {
        ...state,
        know: { ...state.know, teamId: team.id, categoryId: action.id, index, endsAt: Date.now() + 60_000, gained: 0, picks },
      }
    }
    case 'know-mark': {
      const teamId = state.know.teamId
      const category = pack.know.find((item) => item.id === state.know.categoryId)
      if (!teamId || !category || state.know.endsAt == null || Date.now() >= state.know.endsAt) return state
      const teams = action.right ? add(state.teams, teamId, 1) : state.teams
      const picks = {
        ...state.know.picks,
        [teamId]: Array.from(new Set([...(state.know.picks[teamId] ?? []), category.id])),
      }
      return {
        ...state,
        teams,
        know: { ...state.know, index: state.know.index + 1, picks, gained: (state.know.gained ?? 0) + (action.right ? 1 : 0) },
      }
    }
    case 'know-close': {
      const next = nextKnowTeam(state.teams, state.know.picks)
      return { ...state, know: { ...state.know, teamId: next?.id ?? null, categoryId: null, endsAt: null, index: 0, gained: 0 } }
    }
    case 'guess-show':
      return { ...state, guess: { ...state.guess, shown: true } }
    case 'guess-open':
      if (state.guess.used.includes(action.id)) return state
      return { ...state, guess: { ...state.guess, shown: true, currentId: action.id, buzz: { ...emptyBuzz(), armed: true, deadline: Date.now() + 5000 } } }
    case 'guess-right': {
      const item = findGuess(state.guess.currentId)
      if (!item) return state
      return {
        ...state,
        teams: add(state.teams, action.id, item.points),
        guess: { currentId: null, used: [...state.guess.used, item.id], buzz: emptyBuzz(), shown: true },
      }
    }
    case 'guess-wrong':
      return lockActive(state, 0)
    case 'guess-close': {
      if (!state.guess.currentId) return state
      return { ...state, guess: { currentId: null, used: [...state.guess.used, state.guess.currentId], buzz: emptyBuzz(), shown: true } }
    }
    case 'brain-pick': {
      if ((state.brain.played ?? []).includes(action.id) || !brainType(action.id)) return state
      return { ...state, brain: { ...state.brain, groupId: action.id, revealed: false, endsAt: null, done: [], answerOn: false } }
    }
    case 'brain-start': {
      const task = brainSlice(state.brain.groupId, state.game)?.task
      if (!task || state.brain.revealed) return state
      return { ...state, brain: { ...state.brain, revealed: true, endsAt: Date.now() + task.seconds * 1000, done: [], answerOn: false } }
    }
    case 'brain-close': {
      if (!state.brain.groupId) return state
      const played = state.brain.revealed
        ? Array.from(new Set([...(state.brain.played ?? []), state.brain.groupId]))
        : state.brain.played ?? []
      return { ...state, brain: { ...state.brain, groupId: null, revealed: false, endsAt: null, done: [], played, answerOn: false } }
    }
    case 'brain-answer':
      if (!state.brain.revealed) return state
      return { ...state, brain: { ...state.brain, answerOn: true } }
    case 'brain-mark': {
      if (!state.brain.revealed || state.brain.done.includes(action.id)) return state
      return {
        ...state,
        teams: action.right ? add(state.teams, action.id, 2) : state.teams,
        brain: { ...state.brain, done: [...state.brain.done, action.id] },
      }
    }
    case 'buzzer-show':
      return { ...state, buzzer: { ...state.buzzer, visible: true, buzz: { ...emptyBuzz(), armed: true } } }
    case 'buzzer-right': {
      if (!state.buzzer.visible) return state
      return {
        ...state,
        teams: add(state.teams, action.id, 2),
        buzzer: { ...state.buzzer, buzz: { armed: false, activeId: action.id, deadline: null, locked: state.teams.map((team) => team.id) } },
      }
    }
    case 'buzzer-wrong': {
      if (!state.buzzer.visible || state.buzzer.buzz.locked.includes(action.id)) return state
      const locked = [...state.buzzer.buzz.locked, action.id]
      return {
        ...state,
        teams: add(state.teams, action.id, -1),
        buzzer: { ...state.buzzer, buzz: { armed: locked.length < state.teams.length, activeId: null, deadline: null, locked } },
      }
    }
    case 'buzzer-next': {
      const last = buzzerList(state.game).length - 1
      if (state.buzzer.index >= last) {
        return { ...state, buzzer: { ...state.buzzer, index: last + 1, visible: false, buzz: emptyBuzz() } }
      }
      return { ...state, buzzer: { ...state.buzzer, index: state.buzzer.index + 1, visible: false, buzz: emptyBuzz() } }
    }
    case 'final-set':
      return { ...state, final: { ...state.final, setId: action.id, phase: 'idle', endsAt: null, applied: false, checks: {} } }
    case 'final-tasks':
      return { ...state, final: { ...state.final, phase: 'tasks', endsAt: Date.now() + 120_000 } }
    case 'final-hints':
      if (state.final.phase !== 'tasks') return state
      return { ...state, final: { ...state.final, phase: 'hints', endsAt: Date.now() + 60_000 } }
    case 'final-ready':
      if ((state.final.phase !== 'tasks' && state.final.phase !== 'hints') || !state.final.endsAt || state.final.endsAt <= Date.now()) return state
      return { ...state, final: { ...state.final, endsAt: Date.now() - 1000 } }
    case 'final-word':
      return { ...state, final: { ...state.final, phase: 'word', endsAt: Date.now() + 60_000 } }
    case 'final-check': {
      const current = state.final.checks[action.id] ?? [false, false, false, false]
      const next = current.map((value, index) => (index === action.index ? !value : value))
      return { ...state, final: { ...state.final, checks: { ...state.final.checks, [action.id]: next } } }
    }
    case 'final-apply': {
      if (state.final.applied) return state
      const teams = state.teams.map((team) => {
        const flags = state.final.checks[team.id] ?? [false, false, false, false]
        const gained = flags.slice(0, 3).filter(Boolean).length * 2 + (flags[3] ? 4 : 0)
        return { ...team, score: team.score + gained }
      })
      return { ...state, teams, final: { ...state.final, applied: true }, reveal: null }
    }
    case 'reveal-scores':
      return { ...state, reveal: 'scores' }
    case 'reveal-winner':
      return { ...state, reveal: 'winner' }
    case 'set-game': {
      const game = gameNumber(action.game)
      const nextGame = game !== gameNumber(state.game)
      return {
        ...state,
        game,
        guess: nextGame ? { currentId: null, used: [], buzz: emptyBuzz(), shown: false } : state.guess,
        buzzer: { ...state.buzzer, index: 0, visible: false, buzz: emptyBuzz() },
        final: state.final.applied
          ? state.final
          : { ...state.final, setId: finalSetId(game), phase: 'idle', endsAt: null, checks: {} },
      }
    }
    case 'know-start': {
      const next = state.knowStarts.map((value, index) => (
        index === gameNumber(state.game) - 1 ? Math.min(knowLast(), Math.max(0, action.value)) : value
      ))
      return { ...state, knowStarts: next }
    }
    case 'buzz': {
      const buzz = activeBuzz(state)
      if (!buzz || buzz.activeId || buzz.locked.includes(action.id)) return state
      return withBuzz(state, { ...buzz, armed: false, activeId: action.id, deadline: Date.now() + 5000 })
    }
    case 'buzz-timeout': {
      const buzz = activeBuzz(state)
      if (!buzz?.activeId) return buzz?.deadline ? withBuzz(state, { ...buzz, deadline: null }) : state
      return state.round === 'buzzer' ? lockActive(state, -1) : lockActive(state, 0)
    }
    case 'reset':
      return { ...fresh(), game: state.game, knowStarts: state.knowStarts }
    default:
      return state
  }
}

function findGuess(id: string | null) {
  if (!id) return null
  for (const category of pack.guess) {
    const item = category.items.find((entry) => entry.id === id)
    if (item) return item
  }
  return null
}

function loadState(): State {
  try {
    const raw = sessionStorage.getItem(HOST_KEY)
    if (!raw) return fresh()
    const saved = JSON.parse(raw) as State
    if (!saved.teams || saved.teams.length !== 4) return fresh()
    const game = gameNumber(saved.game)
    const listLength = buzzerList(game).length
    const buzzerIndex = saved.buzzer?.index === listLength
      ? listLength
      : saved.buzzer?.visible && saved.buzzer.index >= 0 && saved.buzzer.index < listLength
        ? saved.buzzer.index
        : 0
    return {
      ...fresh(),
      ...saved,
      game,
      knowStarts: loadStarts(),
      namesSaved: Boolean(saved.namesSaved),
      ordered: saved.ordered ?? Boolean(saved.namesSaved),
      shuffling: false,
      shuffleTicks: 0,
      shuffleFinal: null,
      know: {
        ...fresh().know,
        ...saved.know,
        gained: saved.know?.gained ?? 0,
        shown: saved.know?.shown ?? Boolean(saved.know?.teamId || saved.know?.categoryId || saved.know?.endsAt),
        opened: saved.know?.opened ?? Boolean(saved.namesSaved),
      },
      guess: {
        ...fresh().guess,
        ...saved.guess,
        used: saved.guess?.used ?? [],
        buzz: { ...emptyBuzz(), ...saved.guess?.buzz },
        shown: saved.guess?.shown ?? Boolean(saved.guess?.currentId || (saved.guess?.used ?? []).length > 0 || saved.round === 'guess'),
      },
      brain: {
        ...fresh().brain,
        endsAt: saved.brain?.endsAt ?? null,
        done: saved.brain?.done ?? [],
        played: saved.brain?.played ?? [],
        groupId: saved.brain?.groupId ?? null,
        revealed: Boolean(saved.brain?.revealed),
        answerOn: Boolean(saved.brain?.answerOn),
      },
      buzzer: { ...fresh().buzzer, ...saved.buzzer, index: buzzerIndex, seen: saved.buzzer?.seen ?? [], buzz: { ...emptyBuzz(), ...saved.buzzer?.buzz } },
      final: {
        ...fresh().final,
        ...saved.final,
        setId: saved.final?.applied ? saved.final.setId : finalSetId(game),
      },
      stageBase: saved.stageBase?.[saved.round]
        ? saved.stageBase
        : { ...saved.stageBase, [saved.round ?? 'know']: scoreMap(saved.teams) },
      reveal: saved.reveal === 'scores' || saved.reveal === 'winner' ? saved.reveal : null,
    }
  } catch {
    return fresh()
  }
}

const rounds: { id: RoundId; label: string }[] = [
  { id: 'know', label: '1. Know It All' },
  { id: 'guess', label: '2. Guess It' },
  { id: 'brain', label: '3. Brain Battle' },
  { id: 'buzzer', label: '4. Buzzer Rush' },
  { id: 'final', label: '5. Final Code' },
]

export default function Host() {
  const [state, dispatch] = useReducer(reducer, null, loadState)
  const ready = state.namesSaved

  useEffect(() => {
    sessionStorage.setItem(HOST_KEY, JSON.stringify(state))
    localStorage.setItem(STARTS_KEY, JSON.stringify(state.knowStarts))
    publish(toScreen(state))
  }, [state])

  useEffect(() => {
    if (!state.shuffling) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const done = reduce || state.shuffleTicks >= 4
    const id = window.setTimeout(() => dispatch({ type: done ? 'order-finish' : 'order-tick' }), reduce ? 0 : 900)
    return () => window.clearTimeout(id)
  }, [state.shuffling, state.shuffleTicks])

  const deadline = activeBuzz(state)?.deadline ?? null
  useEffect(() => {
    if (!deadline) return
    const wait = Math.max(0, deadline - Date.now())
    const id = window.setTimeout(() => dispatch({ type: 'buzz-timeout' }), wait)
    return () => window.clearTimeout(id)
  }, [deadline])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (['Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Tab'].includes(event.key)) return
      if (state.listening != null) {
        event.preventDefault()
        dispatch({ type: 'bind', index: state.listening, key: event.key })
        beep()
        return
      }
      const team = state.teams.find((item) => item.key && item.key === event.key)
      if (!team) return
      event.preventDefault()
      dispatch({ type: 'buzz', id: team.id })
      beep()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.listening, state.teams])

  const openScreen = () => {
    const url = `${location.origin}${location.pathname}#screen`
    window.open(url, 'iq-arena-screen')
    window.focus()
  }

  return (
    <div className="host">
      <header className="host-bar">
        <div>
          <img className="wordmark wordmark-sm" src="/brand/wordmark.png" alt="IQ ARENA" />
          <p className="hint">Դահլիճի էկրանը քաշիր պրոյեկտորի վրա։</p>
        </div>
        <div className="bar-actions">
          <button type="button" onClick={openScreen}>Բացել էկրանը</button>
          <button type="button" className="ghost" onClick={() => { if (confirm('Սկսե՞լ խաղը նորից')) dispatch({ type: 'reset' }) }}>Նոր խաղ</button>
        </div>
      </header>

      {!ready && <Setup state={state} dispatch={dispatch} />}

      {ready && !state.know.opened && <OrderGate state={state} dispatch={dispatch} />}

      {ready && state.know.opened && (
        <>
          <section className="teams">
            {state.teams.map((team) => (
              <article key={team.id}>
                <span>{team.name}</span>
                <strong>{team.score}</strong>
                <div>
                  <button type="button" onClick={() => dispatch({ type: 'score', id: team.id, delta: -1 })}>−</button>
                  <button type="button" onClick={() => dispatch({ type: 'score', id: team.id, delta: 1 })}>+</button>
                </div>
              </article>
            ))}
          </section>
          <GamePicker state={state} dispatch={dispatch} />
          <nav className="rounds">
            {rounds.map((round) => (
              <button type="button" key={round.id} className={state.round === round.id ? 'on' : ''} onClick={() => dispatch({ type: 'round', round: round.id })}>
                {round.label}
              </button>
            ))}
          </nav>
          {state.round === 'know' && <Know state={state} dispatch={dispatch} />}
          {state.round === 'guess' && <Guess state={state} dispatch={dispatch} />}
          {state.round === 'brain' && <Brain state={state} dispatch={dispatch} />}
          {state.round === 'buzzer' && <Buzzer state={state} dispatch={dispatch} />}
          {state.round === 'final' && <Final state={state} dispatch={dispatch} />}
        </>
      )}
    </div>
  )
}

function GamePicker({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  return (
    <nav className="games">
      {GAMES.map((game) => (
        <button type="button" key={game} className={state.game === game ? 'on' : ''} onClick={() => dispatch({ type: 'set-game', game })}>
          Խաղ {game}
        </button>
      ))}
    </nav>
  )
}

function KnowStart({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const start = state.knowStarts[state.game - 1] ?? 0
  return (
    <div className="know-start">
      <span>Հարցերի սկիզբ</span>
      <button type="button" onClick={() => dispatch({ type: 'know-start', value: start - 1 })}>−</button>
      <strong>{start + 1}</strong>
      <button type="button" onClick={() => dispatch({ type: 'know-start', value: start + 1 })}>+</button>
      <p>Այս խաղի բոլոր առարկաները սկսվում են այս համարից։ Համարը մնում է հիշողության մեջ։</p>
    </div>
  )
}

function OrderGate({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  return (
    <section className="panel">
      <div className="play">
        <h2>Թիմերը</h2>
        <ShuffleLineup teams={state.teams} ordered={state.ordered} />
        {state.ordered ? (
          <button type="button" className="on" onClick={() => dispatch({ type: 'know-open' })}>Բացել 1-ին փուլը</button>
        ) : (
          <button type="button" className="on" disabled={state.shuffling} onClick={() => dispatch({ type: 'order-teams' })}>
            {state.shuffling ? 'Խառնում ենք…' : 'Խառնել հերթը'}
          </button>
        )}
      </div>
    </section>
  )
}

function Setup({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const namesComplete = state.teams.every((team) => team.name.trim())
  return (
    <section className="setup">
      <h1>Թիմերի անունները</h1>
      <ol>
        <li>Միացրու պրոյեկտորը որպես երկրորդ էկրան և անջատիր հայելային ցուցադրումը։</li>
        <li>Բացիր դահլիճի պատուհանը և քաշիր այն պրոյեկտորի վրա։</li>
        <li>Գրիր 4 թիմի անունները և սեղմիր «Պահել անունները»։</li>
      </ol>
      <div className="setup-grid">
        {state.teams.map((team, index) => (
          <label key={team.id}>
            <span>Թիմ {index + 1}</span>
            <input value={team.name} onChange={(event) => dispatch({ type: 'team', index, name: event.target.value })} placeholder="Անուն" />
          </label>
        ))}
      </div>
      <button type="button" disabled={!namesComplete} onClick={() => dispatch({ type: 'save-names' })}>Պահել անունները</button>
    </section>
  )
}

function Answer({ text, note }: { text: string; note?: string }) {
  return (
    <aside className="answer">
      <span>Միայն վարողին</span>
      <strong>{text}</strong>
      {note && <p>{note}</p>}
    </aside>
  )
}

function StageDone({ next, dispatch, revealed }: { next: RoundId | null; dispatch: (action: Action) => void; revealed: boolean }) {
  return (
    <div className="play">
      <h2>Փուլն ավարտված է</h2>
      <p className="hint">{revealed ? 'Միավորներն էկրանին են։' : 'Կարելի է ցույց տալ այս փուլի միավորները։'}</p>
      <button type="button" className="on" onClick={() => dispatch({ type: 'reveal-scores' })}>Ցույց տալ միավորները</button>
      {next && (
        <button type="button" onClick={() => dispatch({ type: 'round', round: next })}>Հաջորդ փուլ</button>
      )}
    </div>
  )
}

function Know({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const category = pack.know.find((item) => item.id === state.know.categoryId)
  const question = category?.questions[state.know.index]
  const playing = Boolean(state.know.categoryId)
  const openPicks = knowPicksNow(state.know.picks, playing ? state.know.teamId : null, playing ? state.know.categoryId : null)
  const turnTeam = playing
    ? state.teams.find((item) => item.id === state.know.teamId) ?? null
    : nextKnowTeam(state.teams, state.know.picks)
  const circle = knowCircle(state.teams, openPicks)
  const turnIndex = turnTeam ? state.teams.findIndex((item) => item.id === turnTeam.id) : -1
  const now = useNow(state.know.endsAt != null)
  const left = leftSeconds(state.know.endsAt, now)
  const locked = state.know.endsAt != null
  const expired = left === 0
  const complete = knowComplete(state.know.picks, state.teams)
  const intro = !state.know.shown && state.know.endsAt == null && !state.know.categoryId && !complete

  if (intro) {
    return (
      <section className="panel">
        <div className="play">
          <h2>Know It All</h2>
          <KnowStart state={state} dispatch={dispatch} />
          <p className="hint">Դահլիճը տեսնում է փուլի նկարը։ Երբ պատրաստ եք, բացեք առարկաները։</p>
          <button type="button" className="on" onClick={() => dispatch({ type: 'know-show' })}>Ցույց տալ առարկաները</button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <KnowStart state={state} dispatch={dispatch} />
      <div className="choice-row">
        {state.teams.map((item, index) => (
          <div key={item.id} className={turnTeam?.id === item.id ? 'turn on' : 'turn'}>
            <b>0{index + 1}</b>
            {item.name}
            <small>{(state.know.picks[item.id] ?? []).length}/2</small>
          </div>
        ))}
      </div>
      {turnTeam && !complete && (
        <>
          <p className="kicker">{circle === 1 ? '1-ին շրջան' : '2-րդ շրջան'} · 0{turnIndex + 1} {turnTeam.name}</p>
          <div className="choice-row wrap">
            {pack.know.map((item) => {
              const ownerId = knowOwner(state.know.picks, item.id)
              const owner = state.teams.find((entry) => entry.id === ownerId)
              const used = Boolean(ownerId)
              return (
                <button type="button" key={item.id} disabled={used || locked} className={state.know.categoryId === item.id ? 'on' : ''} onClick={() => dispatch({ type: 'know-category', id: item.id })}>
                  {item.title}
                  {owner && <small>{owner.name}</small>}
                </button>
              )
            })}
          </div>
        </>
      )}
      {complete && !locked && <StageDone next={NEXT_ROUND.know} dispatch={dispatch} revealed={state.reveal === 'scores'} />}
      {expired && turnTeam && (
        <div className="play">
          <p className="kicker">{category?.title}</p>
          <h2>{turnTeam.name}</h2>
          <p className="who">{state.know.gained} միավոր</p>
          <button type="button" onClick={() => dispatch({ type: 'know-close' })}>Փակել</button>
        </div>
      )}
      {!expired && category && !question && (
        <div className="play">
          <p className="hint">Այս կատեգորիայի հարցերն ավարտվեցին։</p>
          <button type="button" onClick={() => dispatch({ type: 'know-close' })}>Փակել</button>
        </div>
      )}
      {!expired && question && category && (
        <div className="play">
          <p className="kicker">{category.title} · {state.know.index + 1}/{category.questions.length}</p>
          <h2>{question.q}</h2>
          <Clock endsAt={state.know.endsAt} big />
          <div className="choice-row">
            <button type="button" onClick={() => dispatch({ type: 'know-mark', right: true })}>Ճիշտ +1</button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'know-mark', right: false })}>Սխալ / բաց թողնել</button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'know-close' })}>Փակել</button>
          </div>
          <Answer text={question.a} />
        </div>
      )}
    </section>
  )
}

function Guess({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const current = findGuess(state.guess.currentId)
  const category = pack.guess.find((item) => item.items.some((entry) => entry.id === current?.id))
  const active = state.teams.find((team) => team.id === state.guess.buzz.activeId)

  const complete = guessComplete(state.guess.used, state.game)

  if (!state.guess.shown && !current && !complete) {
    return (
      <section className="panel">
        <div className="play">
          <h2>Guess It</h2>
          <p className="hint">Դահլիճը տեսնում է փուլի նկարը։ Երբ պատրաստ եք, բացեք տախտակը։</p>
          <button type="button" className="on" onClick={() => dispatch({ type: 'guess-show' })}>Ցույց տալ տախտակը</button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      {complete && !current && <StageDone next={NEXT_ROUND.guess} dispatch={dispatch} revealed={state.reveal === 'scores'} />}
      {!complete && !current && (
        <div className="guess-host">
          {guessColumns().map((column) => (
            <article key={column.id}>
              <h3>{GUESS_LABEL[column.id] ?? column.title}</h3>
              {POINTS.map((points) => {
                const item = guessCell(column.items, points, state.game)
                if (!item) return <p key={points} className="guess-empty">{points} · չկա</p>
                const taken = state.guess.used.includes(item.id)
                return (
                  <button type="button" key={points} className={taken ? 'spent' : ''} disabled={taken} onClick={() => dispatch({ type: 'guess-open', id: item.id })}>
                    {taken ? 'վերցված է' : `${points} միավոր`}
                  </button>
                )
              })}
            </article>
          ))}
        </div>
      )}
      {current && (
        <div className="play">
          <p className="kicker">{(category && GUESS_LABEL[category.id]) || category?.title} · {current.points} միավոր</p>
          <h2>{category ? GUESS_QUESTION[category.id] : ''}</h2>
          {current.emoji && <p className="emoji">{current.emoji}</p>}
          {current.image && <img src={current.image} alt="" />}
          <Clock endsAt={state.guess.buzz.deadline} big />
          <p className="hint">{active ? `${active.name} · 5 վայրկյան պատասխանի համար` : '5 վայրկյան՝ կոճակը սեղմելու համար'}</p>
          <div className="choice-row">
            {state.teams.map((team) => (
              <button
                type="button"
                key={team.id}
                disabled={state.guess.buzz.locked.includes(team.id) || Boolean(state.guess.buzz.activeId)}
                className={active?.id === team.id ? 'on' : ''}
                onClick={() => dispatch({ type: 'buzz', id: team.id })}
              >
                {team.name}
              </button>
            ))}
          </div>
          {active && <p className="who">{active.name}</p>}
          <p className="hint">Ո՞վ պատասխանեց ճիշտ</p>
          <div className="choice-row">
            {state.teams.map((team) => (
              <button type="button" key={team.id} className={active?.id === team.id ? 'on' : ''} onClick={() => dispatch({ type: 'guess-right', id: team.id })}>
                {team.name} +{current.points}
              </button>
            ))}
          </div>
          <div className="choice-row">
            <button type="button" className="ghost" disabled={!active} onClick={() => dispatch({ type: 'guess-wrong' })}>Սխալ</button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'guess-close' })}>Փակել հարցը</button>
          </div>
          <p className="hint">Սխալ կամ լռություն. այդ թիմն այս հարցից դուրս է, կոճակները նորից են միանում։</p>
          <Answer text={current.answer} />
        </div>
      )}
    </section>
  )
}

function Brain({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const type = brainType(state.brain.groupId)
  const slice = brainSlice(state.brain.groupId, state.game)
  const task = slice?.task ?? null
  const played = state.brain.played ?? []
  const complete = !type && BRAIN_TYPES.every((item) => played.includes(item.id))
  if (complete) {
    return (
      <section className="panel">
        <StageDone next={NEXT_ROUND.brain} dispatch={dispatch} revealed={state.reveal === 'scores'} />
      </section>
    )
  }
  return (
    <section className="panel">
      {!type && (
        <div className="brain-host">
          {BRAIN_TYPES.map((item) => {
            const seconds = brainSlice(item.id, state.game)?.task.seconds
            const taken = played.includes(item.id)
            return (
              <button type="button" key={item.id} className={taken ? 'spent' : ''} disabled={taken} onClick={() => dispatch({ type: 'brain-pick', id: item.id })}>
                <b>{item.title}</b>
                <span>{taken ? 'ավարտված է' : `${seconds} վայրկյան`}</span>
                <p>{item.how}</p>
              </button>
            )
          })}
        </div>
      )}
      {type && task && !state.brain.revealed && (
        <div className="play">
          <p className="kicker">{type.title} · {task.seconds} վայրկյան</p>
          <h2>Բացատրիր տեսակը</h2>
          <p className="hint">{type.how}</p>
          <p className="hint">Դահլիճը հիմա տեսնում է այս տեսակը։ Երբ բոլորը պատրաստ են, բացիր հարցը։</p>
          <button type="button" className="on" onClick={() => dispatch({ type: 'brain-start' })}>Հարցը և ժամանակը</button>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'brain-close' })}>Հետ</button>
        </div>
      )}
      {type && task && state.brain.revealed && <BrainPlay task={task} title={type.title} answerImage={slice?.answerImage ?? null} state={state} dispatch={dispatch} />}
    </section>
  )
}

function BrainPlay({ task, title, answerImage, state, dispatch }: { task: BrainTask; title: string; answerImage: string | null; state: State; dispatch: (action: Action) => void }) {
  const shown = state.brain.answerOn
  const image = shown && answerImage ? answerImage : task.image
  return (
    <div className="play">
      <p className="kicker">{title} · {task.seconds} վայրկյան</p>
      <Clock endsAt={state.brain.endsAt} big />
      <h2>{task.prompt}</h2>
      {shown && <p className="hint">Պատասխանը դահլիճում է</p>}
      {image && <img src={image} alt="" />}
      <button type="button" className="on" disabled={shown} onClick={() => dispatch({ type: 'brain-answer' })}>
        {shown ? 'Պատասխանը երևում է' : 'Ցույց տալ պատասխանը'}
      </button>
      <div className="mark-grid">
        {state.teams.map((team) => {
          const done = state.brain.done.includes(team.id)
          return (
            <div key={team.id}>
              <span>{team.name}</span>
              <button type="button" disabled={done} onClick={() => dispatch({ type: 'brain-mark', id: team.id, right: true })}>Ճիշտ +2</button>
              <button type="button" className="ghost" disabled={done} onClick={() => dispatch({ type: 'brain-mark', id: team.id, right: false })}>0</button>
            </div>
          )
        })}
      </div>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'brain-close' })}>Փակել</button>
      <Answer text={answerImage ? 'Երկրորդ նկարը' : task.answer} note={answerImage ? 'Առաջին նկարը հարցն է, երկրորդը՝ պատասխանը։' : task.note} />
    </div>
  )
}

function Buzzer({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const list = buzzerList(state.game)
  const question = list[state.buzzer.index]
  const complete = !question && !state.buzzer.visible
  if (complete) {
    return (
      <section className="panel">
        <StageDone next={NEXT_ROUND.buzzer} dispatch={dispatch} revealed={state.reveal === 'scores'} />
      </section>
    )
  }
  return (
    <section className="panel">
      {question && (
        <div className="play">
          <p className="kicker">Հարց {state.buzzer.index + 1}/{list.length}</p>
          <h2>{question.q}</h2>
          {question.image && <img src={question.image} alt="" />}
          <button type="button" onClick={() => dispatch({ type: 'buzzer-show' })}>Ցույց տալ հարցը</button>
          <p className="hint">Ո՞վ պատասխանեց</p>
          <div className="mark-grid">
            {state.teams.map((team) => {
              const locked = state.buzzer.buzz.locked.includes(team.id) || !state.buzzer.visible
              return (
                <div key={team.id}>
                  <span>{team.name}</span>
                  <button type="button" disabled={locked} onClick={() => dispatch({ type: 'buzzer-right', id: team.id })}>Ճիշտ +2</button>
                  <button type="button" className="ghost" disabled={locked} onClick={() => dispatch({ type: 'buzzer-wrong', id: team.id })}>Սխալ −1</button>
                </div>
              )
            })}
          </div>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'buzzer-next' })}>Հաջորդը</button>
          <p className="hint">Սխալ կամ լռություն՝ −1։</p>
          <Answer text={question.a} />
        </div>
      )}
    </section>
  )
}

function Final({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  if (state.final.applied) {
    const shown = state.reveal === 'winner'
    return (
      <section className="panel">
        <div className="play">
          <h2>Փուլերն ավարտված են</h2>
          <p className="hint">{shown ? 'Հաղթողը էկրանին է։' : 'Հաշվում ենք միավորները։'}</p>
          <button type="button" className="on" onClick={() => dispatch({ type: 'reveal-winner' })}>Ցույց տալ հաղթողին</button>
        </div>
      </section>
    )
  }
  const set = pack.final.find((item) => item.id === state.final.setId) ?? pack.final[0]
  return (
    <section className="panel">
      <FinalPlay set={set} state={state} dispatch={dispatch} />
    </section>
  )
}

function FinalPlay({ set, state, dispatch }: { set: FinalSet; state: State; dispatch: (action: Action) => void }) {
  const tasks = useMemo(() => set.tasks, [set])
  const now = useNow(state.final.endsAt != null)
  const left = leftSeconds(state.final.endsAt, now)
  const phase = state.final.phase
  const questionsDone = phase === 'tasks' && left === 0
  const hintsOn = phase === 'hints' || phase === 'word'
  return (
    <div className="play">
      <p className="kicker">Խաղ {state.game} · {set.title}</p>
      <Clock endsAt={state.final.endsAt} big />
      <div className="choice-row">
        <button type="button" disabled={phase !== 'idle'} onClick={() => dispatch({ type: 'final-tasks' })}>Ցույց տալ հարցերը</button>
        <button type="button" disabled={left == null || left === 0} onClick={() => dispatch({ type: 'final-ready' })}>Պատրաստ է</button>
        <button type="button" disabled={!questionsDone} onClick={() => dispatch({ type: 'final-hints' })}>Ցույց տալ հուշումները</button>
      </div>
      <p className="hint">
        {phase === 'idle' && 'Էկրանին անիմացիան է։ Բացատրիր կանոնները, հետո բացիր հարցերը։'}
        {phase === 'tasks' && left !== 0 && '2 րոպե։ Եթե պատրաստ են շուտ, սեղմիր «Պատրաստ է»։'}
        {questionsDone && 'Հարցերը փակված են։ Կարող ես բացել հուշումները։'}
        {hintsOn && left !== 0 && '1 րոպե՝ բառը կազմելու համար։ Կարող ես փակել շուտ։'}
        {hintsOn && left === 0 && 'Ժամանակն ավարտված է։'}
      </p>
      <ol className="host-tasks">
        {tasks.map((task, index) => (
          <li key={task.prompt}>
            <p>{index + 1}. {task.prompt} {task.letters && <b>{task.letters}</b>}</p>
            <Answer text={`${task.answer} · վերցրու ${task.take}`} />
          </li>
        ))}
      </ol>
      <Answer text={set.word} note="Վերջնական բառը։ +4 միավոր։" />
      <div className="mark-grid">
        {state.teams.map((team) => {
          const flags = state.final.checks[team.id] ?? [false, false, false, false]
          return (
            <div key={team.id}>
              <span>{team.name}</span>
              {flags.map((on, index) => (
                <button type="button" key={index} className={on ? 'on' : ''} onClick={() => dispatch({ type: 'final-check', id: team.id, index })}>
                  {index < 3 ? index + 1 : 'Բառ'}
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <button type="button" disabled={state.final.applied} onClick={() => dispatch({ type: 'final-apply' })}>
        {state.final.applied ? 'Միավորներն ավելացված են' : 'Ավելացնել միավորները'}
      </button>
    </div>
  )
}

function beep() {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 880
  oscillator.connect(gain)
  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.15, context.currentTime)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.12)
  oscillator.onended = () => context.close()
}

function toScreen(state: State): ScreenView {
  const teams = state.teams.map((team) => ({ id: team.id, name: team.name, score: team.score }))
  const base: ScreenView = {
    teams,
    round: rounds.find((item) => item.id === state.round)?.label ?? '',
    timerEndsAt: null,
    buzzName: null,
    buzzEndsAt: null,
    armed: false,
    kind: 'idle',
    title: '',
    text: '',
    image: null,
    answerImage: null,
    answer: null,
    emoji: null,
    points: null,
    board: null,
    tasks: null,
    hints: null,
    subjects: null,
    topics: null,
    sample: false,
    award: null,
    done: false,
    ordered: state.ordered,
    stageScores: null,
    winner: null,
    tally: false,
  }
  const buzz = activeBuzz(state)
  const buzzerName = state.teams.find((team) => team.id === buzz?.activeId)?.name ?? null

  if (!state.namesSaved) {
    const named = state.teams.filter((team) => team.name.trim())
    if (named.length === 0) return { ...base, teams: [], kind: 'wait', round: '', title: '', ordered: false }
    return {
      ...base,
      teams: named.map((team) => ({ id: team.id, name: team.name.trim(), score: team.score })),
      kind: 'lineup',
      round: '',
      title: '',
      ordered: false,
    }
  }
  if (!state.ordered) {
    return { ...base, kind: 'lineup', round: '', title: '', ordered: false }
  }
  if (!state.know.opened) {
    return { ...base, kind: 'lineup', round: '', title: '', ordered: true }
  }
  if (state.round === 'know') {
    const category = pack.know.find((item) => item.id === state.know.categoryId)
    const question = category?.questions[state.know.index]
    const playing = Boolean(state.know.categoryId)
    const openPicks = knowPicksNow(state.know.picks, playing ? state.know.teamId : null, playing ? state.know.categoryId : null)
    const turn = playing ? state.teams.find((item) => item.id === state.know.teamId) ?? null : nextKnowTeam(state.teams, state.know.picks)
    const circle = knowCircle(state.teams, openPicks)
    const started = state.know.endsAt != null && Boolean(question)
    const finished = knowComplete(state.know.picks, state.teams) && !started && state.know.categoryId == null
    if (finished) return { ...base, ...endScreen(state, 'know') }
    if (!state.know.shown && !started) {
      return { ...base, kind: 'know', title: 'Know It All', sample: true }
    }
    const circleLabel = circle === 1 ? '1-ին շրջան' : '2-րդ շրջան'
    return {
      ...base,
      kind: 'know',
      title: started ? category?.title ?? '' : turn ? circleLabel : 'Ընտրիր առարկա',
      text: started ? question?.q ?? '' : '',
      timerEndsAt: started ? state.know.endsAt : null,
      award: null,
      subjects: started
        ? null
        : pack.know.map((item) => {
            const ownerId = knowOwner(state.know.picks, item.id)
            const owner = state.teams.find((entry) => entry.id === ownerId)
            return { title: item.title, active: item.id === state.know.categoryId, taken: Boolean(owner), team: owner?.name ?? null }
          }),
    }
  }
  if (state.round === 'guess') {
    const current = findGuess(state.guess.currentId)
    if (!current) {
      if (guessComplete(state.guess.used, state.game)) return { ...base, ...endScreen(state, 'guess') }
      if (!state.guess.shown) return { ...base, kind: 'guess', title: 'Guess It', sample: true }
      return {
        ...base,
        kind: 'guess',
        board: guessColumns().map((column) => ({
          title: GUESS_LABEL[column.id] ?? column.title,
          cells: POINTS.map((points) => {
            const item = guessCell(column.items, points, state.game)
            return { points, missing: !item, taken: Boolean(item && state.guess.used.includes(item.id)) }
          }),
        })),
      }
    }
    const column = pack.guess.find((entry) => entry.items.some((item) => item.id === current.id))
    return {
      ...base,
      kind: 'guess',
      title: (column && GUESS_LABEL[column.id]) || column?.title || '',
      text: (column && GUESS_QUESTION[column.id]) || '',
      image: current.image ?? null,
      emoji: current.emoji ?? null,
      points: current.points,
      armed: !state.guess.buzz.activeId && state.guess.buzz.locked.length < state.teams.length,
      buzzName: buzzerName,
      buzzEndsAt: state.guess.buzz.deadline,
    }
  }
  if (state.round === 'brain') {
    const played = state.brain.played ?? []
    const type = brainType(state.brain.groupId)
    const slice = brainSlice(state.brain.groupId, state.game)
    const task = slice?.task ?? null
    if (!type && BRAIN_TYPES.every((item) => played.includes(item.id))) return { ...base, ...endScreen(state, 'brain') }
    if (!type || !task) {
      return {
        ...base,
        kind: 'brain',
        topics: BRAIN_TYPES.map((item) => ({
          id: item.id,
          title: item.title,
          seconds: brainSlice(item.id, state.game)?.task.seconds ?? 0,
          taken: played.includes(item.id),
        })),
      }
    }
    if (!state.brain.revealed) {
      return {
        ...base,
        kind: 'brain',
        title: type.title,
        emoji: type.id,
        sample: true,
      }
    }
    return {
      ...base,
      kind: 'brain',
      title: type.title,
      text: task.prompt,
      image: task.image ?? null,
      answerImage: state.brain.answerOn ? slice?.answerImage ?? null : null,
      answer: state.brain.answerOn ? (slice?.answerImage ? '' : task.answer) : null,
      timerEndsAt: state.brain.endsAt,
    }
  }
  if (state.round === 'buzzer') {
    const list = buzzerList(state.game)
    const question = state.buzzer.visible ? list[state.buzzer.index] : null
    if (!question && state.buzzer.index >= list.length) return { ...base, ...endScreen(state, 'buzzer') }
    if (!question) return { ...base, kind: 'buzzer', sample: true }
    return {
      ...base,
      kind: 'buzzer',
      title: `Հարց ${state.buzzer.index + 1}/${list.length}`,
      text: question.q,
      image: question.image ?? null,
      armed: state.buzzer.visible && !state.buzzer.buzz.activeId && state.buzzer.buzz.locked.length < state.teams.length,
      buzzName: buzzerName,
      buzzEndsAt: state.buzzer.buzz.deadline,
    }
  }
  const set = pack.final.find((item) => item.id === state.final.setId)
  if (state.final.applied) {
    if (state.reveal === 'winner') {
      return {
        ...base,
        kind: 'final',
        done: true,
        tally: false,
        winner: winnerNames(state),
        title: '',
        text: '',
        timerEndsAt: null,
        tasks: null,
        hints: null,
        sample: false,
      }
    }
    return {
      ...base,
      kind: 'final',
      done: true,
      tally: true,
      winner: null,
      stageScores: null,
      title: 'Փուլերն ավարտված են',
      text: 'Հաշվում ենք միավորները',
      timerEndsAt: null,
      tasks: null,
      hints: null,
      sample: false,
    }
  }
  const hintsOn = state.final.phase === 'hints' || state.final.phase === 'word'
  return {
    ...base,
    kind: 'final',
    sample: state.final.phase === 'idle',
    title: '',
    timerEndsAt: state.final.phase === 'idle' ? null : state.final.endsAt,
    tasks: state.final.phase === 'tasks' ? set?.tasks.map((task) => ({ prompt: task.prompt, letters: task.letters })) ?? null : null,
    hints: hintsOn ? set?.tasks.map((task) => task.take) ?? null : null,
  }
}
