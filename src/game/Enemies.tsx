import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, Group, Vector3 } from 'three'
import { useGame } from './store'

const SPAWNS: [number, number, number][] = [
  [-10, 1.25, -8], [9, 1.25, -8], [-11, 1.25, 5], [10, 1.25, 7],
  [1, 1.25, -10], [-8, 1.25, 0], [8, 1.25, -1], [3, 1.25, 9],
  [-2, 1.25, -4], [5, 1.25, 3],
]

const COLORS = ['#7445dc', '#f08a34', '#e64692', '#26bcc4', '#8bcf4f']

function Face({ mood = 0 }: { mood?: number }) {
  return (
    <>
      <mesh position={[-0.22, 0.13, 0.66]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial color="#fffdf5" />
        <Edges color="#27242c" />
      </mesh>
      <mesh position={[0.22, 0.13, 0.66]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial color="#fffdf5" />
        <Edges color="#27242c" />
      </mesh>
      <mesh position={[-0.2 + mood * 0.025, 0.12, 0.805]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="#24212a" />
      </mesh>
      <mesh position={[0.2 + mood * 0.025, 0.12, 0.805]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="#24212a" />
      </mesh>
      <mesh position={[0, -0.24, 0.69]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.045, 8, 20, Math.PI]} />
        <meshBasicMaterial color="#27242c" />
      </mesh>
    </>
  )
}

function Enemy({ id, spawnIndex, wave, onDeath }: {
  id: string
  spawnIndex: number
  wave: number
  onDeath: (headshot: boolean) => void
}) {
  const group = useRef<Group>(null)
  const { camera } = useThree()
  const hp = useRef(54 + wave * 14)
  const dead = useRef(false)
  const [visible, setVisible] = useState(true)
  const lastAttack = useRef(performance.now() + 550 + Math.random() * 700)
  const wobble = useRef(Math.random() * Math.PI * 2)
  const color = COLORS[(spawnIndex + wave) % COLORS.length]
  const spawn = SPAWNS[spawnIndex % SPAWNS.length]
  const speed = 1.55 + wave * 0.17 + (spawnIndex % 3) * 0.11
  const damage = 3.5 + wave * 1.2
  const tmp = useMemo(() => new Vector3(), [])
  const variant = spawnIndex % 4

  const takeDamage = (amount: number, headshot: boolean) => {
    if (dead.current) return
    hp.current -= amount * (headshot ? 1.48 : 1)
    if (hp.current <= 0) {
      dead.current = true
      onDeath(headshot)
      setVisible(false)
    }
  }

  useFrame((_, delta) => {
    if (!visible || !group.current || useGame.getState().phase !== 'wave') return
    const g = group.current
    const player = camera.position
    tmp.set(player.x - g.position.x, 0, player.z - g.position.z)
    const distance = tmp.length()

    if (distance > 2.6) {
      tmp.normalize()
      g.position.x += tmp.x * speed * delta
      g.position.z += tmp.z * speed * delta
    }

    wobble.current += delta * (2.8 + wave * 0.12)
    g.position.y = spawn[1] + Math.sin(wobble.current) * 0.16
    g.lookAt(player.x, g.position.y, player.z)

    const now = performance.now()
    if (distance < 12 && now > lastAttack.current) {
      lastAttack.current = now + Math.max(560, 1520 - wave * 105) + Math.random() * 420
      useGame.getState().damagePlayer(damage, color)
    }
  })

  if (!visible) return null

  return (
    <group ref={group} position={spawn}>
      <mesh scale={1.06}>
        <sphereGeometry args={[0.77, 24, 18]} />
        <meshBasicMaterial color="#26232b" side={BackSide} />
      </mesh>
      <mesh
        castShadow
        userData={{ enemyPart: 'body', enemyId: id, hit: (amount: number) => takeDamage(amount, false) }}
      >
        <sphereGeometry args={[0.74, 24, 18]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh
        position={[0, 0.24, 0.04]}
        scale={[0.86, 0.72, 0.7]}
        userData={{ enemyPart: 'head', enemyId: id, hit: (amount: number) => takeDamage(amount, true) }}
      >
        <sphereGeometry args={[0.65, 18, 14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Face mood={variant - 1} />

      {variant === 0 && (
        <>
          <mesh position={[-0.34, 0.7, 0]} rotation={[0, 0, -0.26]}>
            <coneGeometry args={[0.12, 0.42, 8]} />
            <meshBasicMaterial color="#26232b" />
          </mesh>
          <mesh position={[0.34, 0.7, 0]} rotation={[0, 0, 0.26]}>
            <coneGeometry args={[0.12, 0.42, 8]} />
            <meshBasicMaterial color="#26232b" />
          </mesh>
        </>
      )}
      {variant === 1 && (
        <mesh position={[0, 0.77, 0]}>
          <coneGeometry args={[0.2, 0.52, 8]} />
          <meshToonMaterial color={color} />
          <Edges color="#26232b" />
        </mesh>
      )}
    </group>
  )
}

export function WaveDirector() {
  const phase = useGame((s) => s.phase)
  const wave = useGame((s) => s.wave)
  const maxWave = useGame((s) => s.maxWave)
  const setAliveEnemies = useGame((s) => s.setAliveEnemies)
  const enemyKilled = useGame((s) => s.enemyKilled)
  const setPhase = useGame((s) => s.setPhase)
  const count = Math.min(10, 3 + wave * 2)

  useEffect(() => {
    if (phase === 'wave') setAliveEnemies(count)
  }, [count, phase, setAliveEnemies, wave])

  const onDeath = (headshot: boolean) => {
    enemyKilled(headshot)
    if (useGame.getState().aliveEnemies === 0) {
      window.setTimeout(() => {
        if (wave >= maxWave) setPhase('victory')
        else setPhase('perk')
      }, 900)
    }
  }

  if (phase === 'ready' || phase === 'dead' || phase === 'victory') return null

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Enemy key={`${wave}-${i}`} id={`${wave}-${i}`} spawnIndex={i + wave} wave={wave} onDeath={onDeath} />
      ))}
    </>
  )
}
