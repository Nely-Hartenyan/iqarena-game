import { lazy, Suspense } from 'react'

const Host = lazy(() => import('./host.tsx'))
const Screen = lazy(() => import('./screen.tsx').then((mod) => ({ default: mod.Screen })))

export default function App() {
  const screen = window.location.hash === '#screen'
  const View = screen ? Screen : Host
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  )
}
