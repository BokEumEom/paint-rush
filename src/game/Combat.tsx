import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Matrix3, Quaternion, Raycaster, Shape, ShapeGeometry, Vector2, Vector3, type Intersection, type Object3D } from 'three'
import { useGame } from './store'

type Splat = {
  id: number
  position: Vector3
  quaternion: Quaternion
  color: string
  size: number
  seed: number
}

const COLORS = ['#793fe5', '#ef7a32', '#22bfc4', '#ea3f99', '#84d447', '#16131e']

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

function WeaponView() {
  const { camera } = useThree()
  const group = useRef<Group>(null)
  const shotPulse = useGame((s) => s.shotPulse)
  const slashPulse = useGame((s) => s.slashPulse)
  const shotTime = useRef(0)
  const slashTime = useRef(0)

  useEffect(() => { shotTime.current = performance.now() }, [shotPulse])
  useEffect(() => { slashTime.current = performance.now() }, [slashPulse])

  useFrame((state) => {
    if (!group.current) return
    const base = new Vector3(0, -0.43, -0.7).applyQuaternion(camera.quaternion)
    group.current.position.copy(camera.position).add(base)
    group.current.quaternion.copy(camera.quaternion)

    const t = state.clock.elapsedTime
    const shotKick = Math.max(0, 1 - (performance.now() - shotTime.current) / 110)
    const slash = Math.max(0, 1 - (performance.now() - slashTime.current) / 210)
    group.current.position.y += Math.sin(t * 7.5) * 0.004
    group.current.rotation.x = shotKick * 0.09
    group.current.rotation.z = -slash * 0.72
  })

  return (
    <group ref={group} renderOrder={20}>
      {/* left hand katana */}
      <group position={[-0.42, -0.02, -0.06]} rotation={[0.1, 0.12, -0.08]}>
        <mesh position={[0, 0.19, -0.55]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.055, 0.035, 1.26]} />
          <meshBasicMaterial color="#fbfbf7" depthTest={false} />
          <Edges color="#26232c" />
        </mesh>
        <mesh position={[0, 0.04, 0.05]}>
          <boxGeometry args={[0.15, 0.09, 0.34]} />
          <meshBasicMaterial color="#20202a" depthTest={false} />
          <Edges color="#15141b" />
        </mesh>
      </group>

      {/* right hand paint gun, matching yellow/pink/cyan reference */}
      <group position={[0.37, -0.06, 0.02]} rotation={[0.03, -0.09, 0.12]}>
        <mesh position={[0, 0.04, -0.19]}>
          <boxGeometry args={[0.16, 0.17, 0.58]} />
          <meshBasicMaterial color="#f4c62e" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0, -0.14, 0.02]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.13, 0.36, 0.22]} />
          <meshBasicMaterial color="#ec3c91" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0, 0.05, -0.54]}>
          <boxGeometry args={[0.095, 0.09, 0.24]} />
          <meshBasicMaterial color="#2dc6c9" depthTest={false} />
          <Edges color="#29252d" />
        </mesh>
        <mesh position={[0.07, 0.16, -0.03]}>
          <sphereGeometry args={[0.095, 12, 10]} />
          <meshBasicMaterial color="#7044df" depthTest={false} />
        </mesh>
      </group>
    </group>
  )
}

export function Combat() {
  const { camera, scene } = useThree()
  const [splats, setSplats] = useState<Splat[]>([])
  const nextId = useRef(1)
  const lastShot = useRef(0)
  const lastSlash = useRef(0)
  const raycaster = useMemo(() => new Raycaster(), [])

  const addSplat = (hit: Intersection<Object3D>) => {
    const id = nextId.current++
    const main = makeSplat(hit, id)
    setSplats((prev) => [...prev.slice(-219), main])
  }

  const castShot = (spread = 0) => {
    raycaster.setFromCamera(new Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), camera)
    raycaster.far = 46
    const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.enemyPart || i.object.userData.paintable)
    if (!hit) return
    ;(hit.object.userData.hit as ((damage: number) => void) | undefined)?.(useGame.getState().stats.gunDamage)
    addSplat(hit)
  }

  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault()
    const onMouse = (event: MouseEvent) => {
      if (useGame.getState().phase !== 'wave' || document.pointerLockElement == null) return
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
    if (useGame.getState().phase === 'wave' && useGame.getState().paint < useGame.getState().maxPaint) {
      useGame.getState().refillPaint(delta * 9.2)
    }
  })

  return (
    <>
      <WeaponView />
      {splats.map((splat) => <BlobSplat key={splat.id} splat={splat} />)}
    </>
  )
}
