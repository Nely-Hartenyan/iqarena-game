import { useEffect, useState } from 'react'
import {
  emptyArena,
  listenArena,
  roomFromPath,
  sendBuzz,
  setRoom,
  type ArenaSnap,
} from './arenaLink'

const TEAM_KEY = 'iq-arena-buzz-team'

export default function Buzz() {
  const pathRoom = roomFromPath()
  const [room, setRoomCode] = useState(pathRoom)
  const [draft, setDraft] = useState(pathRoom)
  const [snap, setSnap] = useState<ArenaSnap>(emptyArena)
  const [teamId, setTeamId] = useState(() => localStorage.getItem(TEAM_KEY) ?? '')
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(Boolean(pathRoom))

  useEffect(() => {
    if (!room) return
    setRoom(room)
    setOnline(false)
    let fail = window.setTimeout(() => setOnline(false), 5000)
    const markOnline = () => {
      setOnline(true)
      window.clearTimeout(fail)
    }
    const stop = listenArena(
      room,
      (event) => {
        markOnline()
        if (event.type === 'state') setSnap(event.state)
      },
      markOnline,
    )
    return () => {
      window.clearTimeout(fail)
      stop()
    }
  }, [room])

  useEffect(() => {
    if (!teamId) return
    if (!snap.teams.some((team) => team.id === teamId)) return
    localStorage.setItem(TEAM_KEY, teamId)
  }, [teamId, snap.teams])

  const team = snap.teams.find((item) => item.id === teamId) ?? null
  const locked = team ? snap.locked.includes(team.id) : false
  const active = snap.activeId != null
  const mine = Boolean(team && snap.activeId === team.id)
  const canPress = Boolean(team && snap.armed && !locked && !active && !sending)

  let status = 'Սպասում ենք հարցին…'
  if (!room) status = 'Մուտքագրիր խաղի կոդը։'
  else if (!online) status = 'Միանում ենք… Ստուգիր ինտերնետը։'
  else if (!snap.ready) status = 'Սպասում ենք խաղի մեկնարկին։ Բացիր host էջը։'
  else if (!team) status = 'Ընտրիր քո թիմը։'
  else if (locked) status = 'Այս հարցի համար այլևս չես կարող սեղմել։'
  else if (mine) status = 'Դու ես առաջինը։ Պատասխանիր։'
  else if (active) {
    const name = snap.teams.find((item) => item.id === snap.activeId)?.name ?? 'Ուրիշ թիմ'
    status = `${name} է սեղմել։`
  } else if (snap.armed) status = 'Կարող ես սեղմել։'
  else status = 'Սպասում ենք հարցին…'

  const joinRoom = () => {
    const next = draft.trim().toUpperCase()
    if (!/^[2-9A-HJ-NP-Z]{4}$/.test(next)) return
    setRoom(next)
    setRoomCode(next)
    window.history.replaceState(null, '', `/buzz/${next}`)
  }

  const onBuzz = async () => {
    if (!team || !canPress || !room) return
    setSending(true)
    try {
      await sendBuzz(room, team.id)
    } catch {
      setOnline(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="buzz-page">
      <img className="wordmark wordmark-sm" src="/brand/wordmark.png" alt="IQ ARENA" />
      <p className="kicker">Buzzer Bash</p>
      <h1>{team?.name || 'Թիմի կոճակ'}</h1>
      {room && <p className="buzz-room">Խաղ {room}</p>}
      <p className="hint">{status}</p>

      {!room && (
        <form
          className="buzz-join"
          onSubmit={(event) => {
            event.preventDefault()
            joinRoom()
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            placeholder="ԿՈԴ"
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" className="on">Մտնել</button>
        </form>
      )}

      {room && !team && snap.teams.length > 0 && (
        <div className="buzz-pick">
          {snap.teams.map((item) => (
            <button type="button" key={item.id} onClick={() => setTeamId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      )}

      {team && (
        <button
          type="button"
          className={`buzz-pad${canPress ? ' live' : ''}${mine ? ' mine' : ''}${locked ? ' locked' : ''}`}
          disabled={!canPress}
          onClick={() => void onBuzz()}
        >
          <span>{mine ? 'ԴՈՒ ԵՍ' : locked ? 'ՓԱԿ' : snap.armed ? 'BUZZ' : 'ՍՊԱՍԻՐ'}</span>
        </button>
      )}

      {team && (
        <button type="button" className="ghost" onClick={() => setTeamId('')}>
          Փոխել թիմը
        </button>
      )}
    </main>
  )
}
