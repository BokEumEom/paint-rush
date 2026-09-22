import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Arena } from './game/Arena'
import { Player } from './game/Player'
import { Combat } from './game/Combat'
import { WaveDirector } from './game/Enemies'
import { HUD } from './ui/HUD'

export default function App() {
  return (
    <main id="game-shell">
      <Canvas
        shadows
        camera={{ fov: 88, near: 0.055, far: 95, position: [0, 2.8, 10.5] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            <Arena />
            <Player />
            <Combat />
            <WaveDirector />
          </Physics>
        </Suspense>
        <PointerLockControls pointerSpeed={0.85} />
      </Canvas>
      <HUD />
    </main>
  )
}
