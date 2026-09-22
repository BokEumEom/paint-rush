import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Group,
  Matrix3,
  Quaternion,
  Raycaster,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Intersection,
  type Object3D,
} from 'three'
import { useGame } from './store'
import { useMobileInput } from './mobileInput'

type Splat = {
  id: number
  position: Vector3
  quaternion: Quaternion
  color: string
  size: number
  seed: number
}

type Flash = {
  id: number
  position: Vector3
  quaternion: Quaternion
  color: string
  born: number
}

type Tracer = {
  id: number
  start: Vector3
  end: Vector3
  color: string
  born: number
}

const COLORS = ['#793fe5', '#ef7a32', '#22bfc4', '#ea3f99', '#84d447', '#16131e']
const GUN_COLORS = ['#793fe5', '#ef7a32', '#22bfc4', '#ea3f99']

function worldNormal(hit: Intersection<Object3D>) {
  if (!hit.face) return new Vector3(0, 1, 0)
  const normalMatrix = new Matrix3().getNormalMatrix(hit.object.matrixWorld)
  return hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
}

function makeSplat(hit: Intersection<Object3D>, id: number): Splat {
  const normal = worldNormal(hit)
  return {
    id,
    position: hit.point.clone().addScaledVector(normal, 0.016),
    quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal),
    color: COLORS[id % COLORS.length],
    size: 0.48 + ((id * 17) % 7) * 0.055,
    seed: id * 13.71,
  }
}

function makeBurstShape(seed: number) {
  const shape = new Shape()
  const count = 16
  for (let i = 0; i <= count; i += 1) {
    const a = (i / count) * Math.PI * 2
    const r = i % 2 === 0 ? 1 : 0.36 + Math.sin(seed + i * 0.7) * 0.06
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return shape
}

function BlobSplat({ splat }: { splat: Splat }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    const count = 20
    for (let i = 0; i <= count; i += 1) {
      const a = (i / count) * Math.PI * 2
      const n = 0.72 + Math.sin(a * 3 + splat.seed) * 0.12 + Math.sin(a * 7 + splat.seed * 0.4) * 0.11
      const x = Math.cos(a) * n
      const y = Math.sin(a) * n
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    return new ShapeGeometry(shape)
  }, [splat.seed])

  return (
    <group position={splat.position} quaternion={splat.quaternion} scale={splat.size} renderOrder={3}>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={splat.color} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {[[-0.92, 0.38, 0.19], [0.94, -0.17, 0.14], [0.56, 0.78, 0.11], [-0.4, -0.87, 0.09]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0.001]} scale={p[2]}>
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={splat.color} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </group>
  )
}

function WeaponView({ flashes }: { flashes: Flash[] }) {
  const { camera } = useThree()
  const group = useRef<Group>(null)
  const swordGroup = useRef<Group>(null)
  const gunGroup = useRef<Group>(null)
  const shotPulse = useGame((s) => s.shotPulse)
  const slashPulse = useGame((s) => s.slashPulse)
  const shotTime = useRef(0)
  const slashTime = useRef(0)

  useEffect(() => {
    shotTime.current = performance.now()
  }, [shotPulse])
  useEffect(() => {
    slashTime.current = performance.now()
  }, [slashPulse])

  useFrame((state) => {
    if (!group.current) return

    const base = new Vector3(0, -0.43, -0.7).applyQuaternion(camera.quaternion)
    group.current.position.copy(camera.position).add(base)
    group.current.quaternion.copy(camera.quaternion)

    const t = state.clock.elapsedTime
    const shotKick = Math.max(0, 1 - (performance.now() - shotTime.current) / 135)
    const slash = Math.max(0, 1 - (performance.now() - slashTime.current) / 235)
    const bobY = Math.sin(t * 7.1) * 0.004
    const bobX = Math.sin(t * 3.2) * 0.003
    group.current.position.y += bobY
    group.current.position.x += bobX

    if (gunGroup.current) {
      gunGroup.current.position.set(0.37 + shotKick * 0.04, -0.06 - shotKick * 0.015, 0.02 + shotKick * 0.15)
      gunGroup.current.rotation.set(0.03 - shotKick * 0.2, -0.09 - shotKick * 0.04, 0.12 + shotKick * 0.06)
    }

    if (swordGroup.current) {
      swordGroup.current.position.set(-0.42 - slash * 0.05, -0.02 - slash * 0.02, -0.06 + slash * 0.04)
      swordGroup.current.rotation.set(0.1 + slash * 0.18, 0.12 - slash * 0.3, -0.08 - slash * 1.2)
    }
  })

  return (
    <group ref={group} renderOrder={20}>
      <group ref={swordGroup} position={[-0.42, -0.02, -0.06]} rotation={[0.1, 0.12, -0.08]}>
        <mesh position={[0.015, 0.31, -0.78]} rotation={[0.07, 0, 0]}>
          <boxGeometry args={[0.062, 0.025, 1.4]} />
          <meshBasicMaterial color="#fffef9" depthTest={false} />
          <Edges color="#26232c" />
        </mesh>
        <mesh position={[0.015, 0.31, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.032, 0.18, 4]} />
          <meshBasicMaterial color="#fffef9" depthTest={false} />
          <Edges color="#26232c" />
        </mesh>
        <mesh position={[0.01, 0.14, -0.03]}>
          <boxGeometry args={[0.21, 0.04, 0.06]} />
          <meshBasicMaterial color="#19171f" depthTest={false} />
          <Edges color="#0e0d12" />
        </mesh>
        <mesh position={[0, 0.02, 0.09]} rotation={[0.02, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.042, 0.48, 10]} />
          <meshBasicMaterial color="#17151d" depthTest={false} />
          <Edges color="#0d0c10" />
        </mesh>
        {[-0.12, -0.04, 0.04, 0.12].map((z) => (
          <mesh key={z} position={[0, 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 6, 10]} />
            <meshBasicMaterial color="#f2f0e6" depthTest={false} />
          </mesh>
        ))}
        <mesh position={[0, -0.12, 0.22]} rotation={[0.45, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.16, 4, 8]} />
          <meshBasicMaterial color="#d9d6c9" depthTest={false} />
          <Edges color="#2a2730" />
        </mesh>
      </group>

      <group ref={gunGroup} position={[0.37, -0.06, 0.02]} rotation={[0.03, -0.09, 0.12]}>
        <mesh position={[0.0, 0.06, -0.22]} rotation={[0.05, 0, 0]}>
          <capsuleGeometry args={[0.09, 0.48, 6, 12]} />
          <meshBasicMaterial color="#f4c62e" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.0, 0.09, -0.2]}>
          <boxGeometry args={[0.22, 0.12, 0.46]} />
          <meshBasicMaterial color="#f4c62e" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.0, -0.13, -0.02]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[0.11, 0.36, 0.16]} />
          <meshBasicMaterial color="#ec3c91" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.02, 0.18, 0.02]} rotation={[0.05, 0.1, 0]}>
          <sphereGeometry args={[0.11, 14, 12]} />
          <meshBasicMaterial color="#7044df" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.0, 0.05, -0.67]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.075, 0.26, 12]} />
          <meshBasicMaterial color="#2dc6c9" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.0, 0.05, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.036, 0.14, 10]} />
          <meshBasicMaterial color="#121016" depthTest={false} />
          <Edges color="#0b0a0f" />
        </mesh>
        <mesh position={[-0.12, 0.05, -0.12]} rotation={[0, 0, 0.12]}>
          <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
          <meshBasicMaterial color="#ea6e2c" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.14, 0.02, -0.16]} rotation={[0, 0, -0.12]}>
          <capsuleGeometry args={[0.035, 0.16, 4, 8]} />
          <meshBasicMaterial color="#e93c97" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.03, 0.18, -0.44]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.14, 0.07, 0.12]} />
          <meshBasicMaterial color="#fbefaf" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
      </group>

      {flashes.map((flash) => (
        <group key={flash.id} position={flash.position} quaternion={flash.quaternion} renderOrder={30}>
          <mesh scale={[0.12, 0.12, 0.12]}>
            <shapeGeometry args={[makeBurstShape(flash.id)]} />
            <meshBasicMaterial color={flash.color} depthTest={false} transparent opacity={0.95} blending={AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0, -0.06]} scale={[0.2, 0.06, 0.06]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#fff7c2" depthTest={false} transparent opacity={0.8} blending={AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ShotTracer({ tracer }: { tracer: Tracer }) {
  const dir = useMemo(() => tracer.end.clone().sub(tracer.start), [tracer])
  const mid = useMemo(() => tracer.start.clone().add(tracer.end).multiplyScalar(0.5), [tracer])
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()),
    [dir],
  )
  return (
    <group position={mid} quaternion={quaternion} renderOrder={25}>
      <mesh>
        <cylinderGeometry args={[0.018, 0.028, dir.length(), 8]} />
        <meshBasicMaterial color={tracer.color} transparent opacity={0.96} blending={AdditiveBlending} />
      </mesh>
      <mesh scale={[1, dir.length() * 0.4, 1]}>
        <cylinderGeometry args={[0.045, 0.045, 1, 8]} />
        <meshBasicMaterial color="#fff8d5" transparent opacity={0.22} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

export function Combat() {
  const { camera, scene } = useThree()
  const [splats, setSplats] = useState<Splat[]>([])
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const nextId = useRef(1)
  const lastShot = useRef(0)
  const lastSlash = useRef(0)
  const seenBlade = useRef(0)
  const raycaster = useMemo(() => new Raycaster(), [])

  const addSplat = (hit: Intersection<Object3D>) => {
    const id = nextId.current++
    const main = makeSplat(hit, id)
    setSplats((prev) => [...prev.slice(-219), main])
  }

  const getMuzzlePose = () => {
    const muzzle = new Vector3(0.36, -0.16, -0.98).applyQuaternion(camera.quaternion).add(camera.position)
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), forward)
    return { muzzle, quaternion }
  }

  const spawnShotVisuals = (end: Vector3) => {
    const id = nextId.current++
    const tone = GUN_COLORS[id % GUN_COLORS.length]
    const { muzzle, quaternion } = getMuzzlePose()
    setFlashes((prev) => [...prev.slice(-5), { id, position: muzzle, quaternion, color: tone, born: performance.now() }])
    setTracers((prev) => [...prev.slice(-8), { id, start: muzzle, end: end.clone(), color: tone, born: performance.now() }])
  }

  const castShot = (spread = 0) => {
    raycaster.setFromCamera(new Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), camera)
    raycaster.far = 46
    const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.enemyPart || i.object.userData.paintable)
    const end = hit
      ? hit.point
      : raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(35))
    spawnShotVisuals(end)
    if (!hit) return
    ;(hit.object.userData.hit as ((damage: number) => void) | undefined)?.(useGame.getState().stats.gunDamage)
    addSplat(hit)
  }

  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault()
    const onMouse = (event: MouseEvent) => {
      if (useGame.getState().phase !== 'wave' || (document.pointerLockElement == null && !useMobileInput.getState().active)) return
      const now = performance.now()
      if (event.button === 0 && now - lastShot.current > 108) {
        lastShot.current = now
        if (!useGame.getState().consumePaint(2.4)) return
        useGame.getState().triggerShot()
        castShot(0.002)
        if (Math.random() < useGame.getState().stats.doubleTapChance) castShot(0.022)
      }
      if (event.button === 2 && now - lastSlash.current > 320) {
        lastSlash.current = now
        useGame.getState().triggerSlash()
        raycaster.setFromCamera(new Vector2(0, 0), camera)
        raycaster.far = useGame.getState().stats.swordRange
        const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.enemyPart)
        if (hit) {
          ;(hit.object.userData.hit as ((damage: number) => void) | undefined)?.(useGame.getState().stats.swordDamage)
          addSplat(hit)
        }
      }
    }
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('mousedown', onMouse)
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('mousedown', onMouse)
    }
  }, [camera, raycaster, scene])

  useFrame((_, delta) => {
    const now = performance.now()
    const mobile = useMobileInput.getState()

    if (mobile.active && useGame.getState().phase === 'wave') {
      if (mobile.fireHeld && now - lastShot.current > 108) {
        lastShot.current = now
        if (useGame.getState().consumePaint(2.4)) {
          useGame.getState().triggerShot()
          castShot(0.002)
          if (Math.random() < useGame.getState().stats.doubleTapChance) castShot(0.022)
        }
      }

      if (mobile.bladePulse !== seenBlade.current) {
        seenBlade.current = mobile.bladePulse
        if (now - lastSlash.current > 320) {
          lastSlash.current = now
          useGame.getState().triggerSlash()
          raycaster.setFromCamera(new Vector2(0, 0), camera)
          raycaster.far = useGame.getState().stats.swordRange
          const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.enemyPart)
          if (hit) {
            ;(hit.object.userData.hit as ((damage: number) => void) | undefined)?.(useGame.getState().stats.swordDamage)
            addSplat(hit)
          }
        }
      }
    }

    if (useGame.getState().phase === 'wave' && useGame.getState().paint < useGame.getState().maxPaint) {
      useGame.getState().refillPaint(delta * 9.2)
    }
    setFlashes((prev) => (prev.some((f) => now - f.born > 75) ? prev.filter((f) => now - f.born <= 75) : prev))
    setTracers((prev) => (prev.some((t) => now - t.born > 90) ? prev.filter((t) => now - t.born <= 90) : prev))
  })

  return (
    <>
      <WeaponView flashes={flashes} />
      {tracers.map((tracer) => <ShotTracer key={tracer.id} tracer={tracer} />)}
      {splats.map((splat) => <BlobSplat key={splat.id} splat={splat} />)}
    </>
  )
}
