import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Matrix3,
  Quaternion,
  Raycaster,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
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

type PaintShot = {
  id: number
  start: Vector3
  end: Vector3
  color: string
  born: number
}

const COLORS = ['#793fe5', '#ef7a32', '#22bfc4', '#ea3f99', '#84d447', '#16131e']
const GUN_COLORS = ['#22bfc4', '#ea3f99', '#ef7a32', '#84d447']
const INK = '#25212b'

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

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
    size: 0.5 + ((id * 17) % 7) * 0.06,
    seed: id * 13.71,
  }
}

function polygon(points: Array<[number, number]>) {
  const shape = new Shape()
  points.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()
  return new ShapeGeometry(shape)
}

function makeBurstShape(seed: number) {
  const shape = new Shape()
  const count = 16
  for (let i = 0; i <= count; i += 1) {
    const a = (i / count) * Math.PI * 2
    const r = i % 2 === 0 ? 1 : 0.35 + Math.sin(seed + i * 0.7) * 0.06
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return shape
}

function FlatPiece({
  geometry,
  color,
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  outline = 1.08,
}: {
  geometry: BufferGeometry
  color: string
  position?: [number, number, number]
  rotation?: number
  scale?: number | [number, number, number]
  outline?: number
}) {
  const vectorScale = typeof scale === 'number' ? ([scale, scale, scale] as const) : scale
  return (
    <group position={position} rotation={[0, 0, rotation]} scale={vectorScale}>
      <mesh position={[0, 0, -0.005]} scale={[outline, outline, 1]} renderOrder={20}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial color={INK} side={DoubleSide} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, 0.002]} renderOrder={21}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial color={color} side={DoubleSide} depthTest={false} />
      </mesh>
    </group>
  )
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
        <meshBasicMaterial color={splat.color} polygonOffset polygonOffsetFactor={-3} side={DoubleSide} />
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

function WeaponView() {
  const { camera } = useThree()
  const root = useRef<Group>(null)
  const sword = useRef<Group>(null)
  const gun = useRef<Group>(null)
  const muzzleFlash = useRef<Group>(null)
  const slashTrail = useRef<Group>(null)
  const shotPulse = useGame((s) => s.shotPulse)
  const slashPulse = useGame((s) => s.slashPulse)
  const shotTime = useRef(-9999)
  const slashTime = useRef(-9999)
  const comboStep = useRef(0)

  const geometry = useMemo(() => ({
    blade: polygon([
      [-0.055, -0.78],
      [0.065, -0.78],
      [0.075, 0.62],
      [0.015, 0.82],
      [-0.072, 0.76],
    ]),
    bladeHighlight: polygon([
      [-0.025, -0.7],
      [-0.002, -0.7],
      [0.02, 0.62],
      [-0.006, 0.69],
      [-0.025, 0.6],
    ]),
    body: polygon([
      [-0.24, 0.12],
      [0.33, 0.1],
      [0.54, -0.14],
      [-0.18, -0.17],
    ]),
    underBody: polygon([
      [-0.18, -0.18],
      [0.4, -0.17],
      [0.31, -0.3],
      [-0.29, -0.27],
    ]),
    barrel: polygon([
      [-0.68, 0.13],
      [-0.22, 0.1],
      [-0.2, -0.02],
      [-0.68, 0.01],
    ]),
    muzzle: polygon([
      [-0.78, 0.17],
      [-0.66, 0.15],
      [-0.66, -0.03],
      [-0.79, -0.05],
    ]),
    connector: polygon([
      [0.18, 0.13],
      [0.33, 0.12],
      [0.35, 0.28],
      [0.22, 0.28],
    ]),
    trigger: polygon([
      [0.12, -0.16],
      [0.23, -0.16],
      [0.19, -0.28],
      [0.08, -0.27],
    ]),
  }), [])

  useEffect(() => {
    shotTime.current = performance.now()
  }, [shotPulse])

  useEffect(() => {
    slashTime.current = performance.now()
    comboStep.current = (comboStep.current + 1) % 3
  }, [slashPulse])

  useFrame((state) => {
    if (!root.current) return

    const base = new Vector3(0, -0.39, -0.63).applyQuaternion(camera.quaternion)
    root.current.position.copy(camera.position).add(base)
    root.current.quaternion.copy(camera.quaternion)

    const now = performance.now()
    const t = state.clock.elapsedTime
    root.current.position.y += Math.sin(t * 7.2) * 0.004
    root.current.position.x += Math.sin(t * 3.2) * 0.0025

    const shotAge = (now - shotTime.current) / 145
    const shotActive = shotAge >= 0 && shotAge <= 1
    const shotWave = shotActive ? Math.sin(Math.PI * shotAge) : 0

    if (gun.current) {
      gun.current.position.set(
        0.43 + shotWave * 0.045,
        -0.11 - shotWave * 0.025,
        -0.02 + shotWave * 0.09,
      )
      gun.current.rotation.set(0, 0, -0.21 - shotWave * 0.1)
    }

    if (muzzleFlash.current) {
      muzzleFlash.current.visible = shotActive && shotAge < 0.52
      const flashScale = shotActive ? 0.55 + easeOutBack(Math.min(1, shotAge * 2.2)) * 0.7 : 0.1
      muzzleFlash.current.scale.setScalar(flashScale)
      muzzleFlash.current.rotation.z = -0.12 + shotAge * 0.35
    }

    const slashAge = (now - slashTime.current) / 285
    const slashActive = slashAge >= 0 && slashAge <= 1
    const slashWave = slashActive ? Math.sin(Math.PI * slashAge) : 0
    const stage = comboStep.current

    if (sword.current) {
      let rotationZ = -0.31
      let x = -0.46
      let y = -0.02
      let z = -0.035
      let scale = 0.94

      if (slashActive) {
        if (stage === 0) {
          rotationZ += slashWave * 1.0
          x += slashWave * 0.11
          y += slashWave * 0.04
        } else if (stage === 1) {
          rotationZ -= slashWave * 0.9
          x += slashWave * 0.08
          y -= slashWave * 0.03
        } else {
          rotationZ += slashWave * 0.2
          x += slashWave * 0.25
          y += slashWave * 0.1
          z -= slashWave * 0.24
          scale += slashWave * 0.22
        }
      }

      sword.current.position.set(x, y, z)
      sword.current.rotation.set(0.015, 0, rotationZ)
      sword.current.scale.setScalar(scale)
    }

    if (slashTrail.current) {
      slashTrail.current.visible = slashActive && slashAge > 0.08 && slashAge < 0.82
      slashTrail.current.rotation.z = stage === 1 ? -1.15 : stage === 2 ? -0.35 : -0.12
      slashTrail.current.scale.setScalar(0.9 + slashWave * 0.18)
    }
  })

  return (
    <group ref={root} renderOrder={20}>
      <group ref={sword} position={[-0.46, -0.02, -0.035]} rotation={[0.015, 0, -0.31]} scale={0.94}>
        <FlatPiece geometry={geometry.blade} color="#fbfbf5" outline={1.075} />
        <mesh geometry={geometry.bladeHighlight} position={[-0.012, 0, 0.012]} renderOrder={23}>
          <meshBasicMaterial color="#d8d5e7" transparent opacity={0.8} depthTest={false} side={DoubleSide} />
        </mesh>
      </group>

      <group ref={slashTrail} visible={false} position={[-0.17, 0.03, -0.025]} renderOrder={19}>
        <mesh>
          <ringGeometry args={[0.48, 0.63, 36, 1, 0.15, 1.65]} />
          <meshBasicMaterial color="#fffdf6" transparent opacity={0.22} depthTest={false} side={DoubleSide} />
        </mesh>
      </group>

      <group ref={gun} position={[0.43, -0.11, -0.02]} rotation={[0, 0, -0.21]} scale={0.78}>
        <FlatPiece geometry={geometry.barrel} color="#f3c63b" position={[0, 0, 0.004]} outline={1.07} />
        <FlatPiece geometry={geometry.muzzle} color="#282333" position={[0, 0, 0.012]} outline={1.04} />
        <FlatPiece geometry={geometry.underBody} color="#31c6cb" position={[0, 0, 0.006]} outline={1.07} />
        <FlatPiece geometry={geometry.body} color="#eb367f" position={[0, 0, 0.014]} outline={1.07} />
        <FlatPiece geometry={geometry.connector} color="#353043" position={[0, 0, 0.016]} outline={1.06} />
        <FlatPiece geometry={geometry.trigger} color="#24212b" position={[0, 0, 0.017]} outline={1.02} />

        <mesh position={[0.36, 0.29, 0.012]} renderOrder={20} scale={1.08}>
          <circleGeometry args={[0.145, 24]} />
          <meshBasicMaterial color={INK} depthTest={false} side={DoubleSide} />
        </mesh>
        <mesh position={[0.36, 0.29, 0.022]} renderOrder={21}>
          <circleGeometry args={[0.145, 24]} />
          <meshBasicMaterial color="#77d44d" depthTest={false} side={DoubleSide} />
        </mesh>
        <mesh position={[0.405, 0.335, 0.027]} renderOrder={22}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#bff28f" transparent opacity={0.72} depthTest={false} />
        </mesh>

        <group ref={muzzleFlash} position={[-0.8, 0.06, 0.035]} visible={false}>
          <mesh renderOrder={30}>
            <shapeGeometry args={[makeBurstShape(2.5)]} />
            <meshBasicMaterial color="#f5d43d" depthTest={false} side={DoubleSide} blending={AdditiveBlending} />
          </mesh>
          <mesh scale={0.48} position={[0, 0, 0.006]} renderOrder={31}>
            <shapeGeometry args={[makeBurstShape(4.1)]} />
            <meshBasicMaterial color="#fff7c8" depthTest={false} side={DoubleSide} blending={AdditiveBlending} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function PaintProjectile({ shot }: { shot: PaintShot }) {
  const group = useRef<Group>(null)
  const direction = useMemo(() => shot.end.clone().sub(shot.start), [shot])
  const distance = direction.length()
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction.clone().normalize()),
    [direction],
  )

  useFrame(() => {
    if (!group.current) return
    const age = Math.min(1, (performance.now() - shot.born) / 88)
    const eased = 1 - Math.pow(1 - age, 2)
    group.current.position.copy(shot.start).lerp(shot.end, eased)
    group.current.quaternion.copy(orientation)
    const stretch = 1 + Math.min(distance, 20) * 0.035
    group.current.scale.set(0.075 * stretch, 0.075, 0.15 + (1 - age) * 0.12)
  })

  return (
    <group ref={group} position={shot.start} renderOrder={25}>
      <mesh>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={shot.color} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, 0.12]} scale={0.5}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#fff4bf" transparent opacity={0.55} depthTest={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

export function Combat() {
  const { camera, scene } = useThree()
  const [splats, setSplats] = useState<Splat[]>([])
  const [shots, setShots] = useState<PaintShot[]>([])
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

  const getMuzzlePosition = () =>
    new Vector3(0.17, -0.18, -0.92).applyQuaternion(camera.quaternion).add(camera.position)

  const spawnShotVisual = (end: Vector3) => {
    const id = nextId.current++
    const tone = GUN_COLORS[id % GUN_COLORS.length]
    setShots((prev) => [
      ...prev.slice(-10),
      { id, start: getMuzzlePosition(), end: end.clone(), color: tone, born: performance.now() },
    ])
  }

  const castShot = (spread = 0) => {
    raycaster.setFromCamera(
      new Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread),
      camera,
    )
    raycaster.far = 46
    const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.enemyPart || i.object.userData.paintable)
    const end = hit ? hit.point : raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(30))
    spawnShotVisual(end)
    if (!hit) return
    ;(hit.object.userData.hit as ((damage: number) => void) | undefined)?.(useGame.getState().stats.gunDamage)
    addSplat(hit)
  }

  const slash = () => {
    const now = performance.now()
    if (now - lastSlash.current <= 280) return
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

  const shoot = () => {
    const now = performance.now()
    if (now - lastShot.current <= 108) return
    lastShot.current = now
    if (!useGame.getState().consumePaint(2.4)) return
    useGame.getState().triggerShot()
    castShot(0.002)
    if (Math.random() < useGame.getState().stats.doubleTapChance) castShot(0.022)
  }

  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault()
    const onMouse = (event: MouseEvent) => {
      if (useGame.getState().phase !== 'wave' || (document.pointerLockElement == null && !useMobileInput.getState().active)) return
      if (event.button === 0) shoot()
      if (event.button === 2) slash()
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
      if (mobile.fireHeld) shoot()
      if (mobile.bladePulse !== seenBlade.current) {
        seenBlade.current = mobile.bladePulse
        slash()
      }
    }

    if (useGame.getState().phase === 'wave' && useGame.getState().paint < useGame.getState().maxPaint) {
      useGame.getState().refillPaint(delta * 9.2)
    }
    setShots((prev) => (prev.some((shot) => now - shot.born > 105) ? prev.filter((shot) => now - shot.born <= 105) : prev))
  })

  return (
    <>
      <WeaponView />
      {shots.map((shot) => <PaintProjectile key={shot.id} shot={shot} />)}
      {splats.map((splat) => <BlobSplat key={splat.id} splat={splat} />)}
    </>
  )
}
