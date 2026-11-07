import { lazy, Suspense, useEffect, useState } from 'react'

const Host = lazy(() => import('./host.tsx'))
const Screen = lazy(() => import('./screen.tsx').then((mod) => ({ default: mod.Screen })))
const Buzz = lazy(() => import('./buzz.tsx'))

function currentView() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/screen') return 'screen'
  if (path === '/buzz' || path.startsWith('/buzz/')) return 'buzz'
  return 'host'
}

function migrateHash() {
  const hash = window.location.hash
  if (hash === '#screen') {
    window.history.replaceState(null, '', '/screen')
    return
  }
  if (hash === '#buzz') {
    window.history.replaceState(null, '', '/buzz')
  }
}

export default function App() {
  const [view, setView] = useState(() => {
    migrateHash()
    return currentView()
  })

  useEffect(() => {
    const sync = () => setView(currentView())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const View = view === 'screen' ? Screen : view === 'buzz' ? Buzz : Host
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  )
}
