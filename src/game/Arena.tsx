import { useMemo } from 'react'
import { Edges } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const INK = '#2a2831'
const PAPER = '#f5f0e6'

function useDoodleTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, 512, 512)
    ctx.strokeStyle = '#b9aea0'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.58

    const star = (x: number, y: number, r: number) => {
      ctx.beginPath()
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 === 0 ? r : r * 0.42
        const px = x + Math.cos(a) * rr
        const py = y + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }

    star(88, 106, 26)
    star(392, 328, 18)
    star(256, 430, 14)

    ctx.beginPath()
    ctx.arc(372, 116, 34, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(359, 109, 3, 0, Math.PI * 2)
    ctx.arc(385, 109, 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(372, 124, 15, 0.1, Math.PI - 0.1)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(120, 330)
    ctx.bezierCurveTo(150, 292, 175, 360, 208, 318)
    ctx.bezierCurveTo(240, 278, 270, 354, 302, 302)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(100, 390, 45, 0.2, Math.PI * 1.7)
    ctx.arc(100, 390, 30, 0.1, Math.PI * 1.6)
    ctx.arc(100, 390, 16, 0, Math.PI * 1.45)
    ctx.stroke()

    ctx.globalAlpha = 1
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(2.2, 1.35)
    return texture
  }, [])
}

function InkBox({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  scale: [number, number, number]
  color: string
  rotation?: [number, number, number]
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      <mesh castShadow receiveShadow userData={{ paintable: true, grapple: true }}>
        <boxGeometry args={scale} />
        <meshToonMaterial color={color} />
        <Edges color={INK} threshold={15} />
      </mesh>
    </RigidBody>
  )
}

function DoodleWall({
  position,
  scale,
  rotation = [0, 0, 0],
  texture,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  texture: CanvasTexture
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      <mesh receiveShadow userData={{ paintable: true, grapple: true }}>
        <boxGeometry args={scale} />
        <meshToonMaterial color={PAPER} map={texture} />
        <Edges color="#514b50" threshold={15} />
      </mesh>
    </RigidBody>
  )
}

export function Arena() {
  const doodles = useDoodleTexture()

  return (
    <>
      <color attach="background" args={['#d7f0ed']} />
      <fog attach="fog" args={['#d7f0ed', 34, 68]} />
      <hemisphereLight args={['#fff8e8', '#8fbab5', 2.3]} />
      <directionalLight castShadow intensity={2.5} position={[8, 16, 7]} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />

      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.22, 0]}>
        <mesh receiveShadow userData={{ paintable: true, grapple: true }}>
          <boxGeometry args={[34, 0.44, 28]} />
          <meshToonMaterial color="#f8f2e8" />
        </mesh>
      </RigidBody>
      <gridHelper args={[34, 34, '#afa9a2', '#d2ccc4']} position={[0, 0.012, 0]} />

      <DoodleWall position={[0, 4.5, -14]} scale={[34, 9, 0.36]} texture={doodles} />
      <DoodleWall position={[0, 4.5, 14]} scale={[34, 9, 0.36]} texture={doodles} />
      <DoodleWall position={[-17, 4.5, 0]} scale={[0.36, 9, 28]} texture={doodles} />
      <DoodleWall position={[17, 4.5, 0]} scale={[0.36, 9, 28]} texture={doodles} />

      {/* Main silhouettes copied from the reference frame library */}
      <InkBox position={[-8.7, 1.9, -4.2]} scale={[2.1, 3.8, 2.2]} color="#65b94f" />
      <InkBox position={[8.8, 2.7, 0.4]} scale={[2.4, 5.4, 2.3]} color="#e73f91" />
      <InkBox position={[2.4, 2.45, -8.5]} scale={[1.85, 4.9, 1.8]} color="#7a48db" />
      <InkBox position={[-11.8, 1.15, 3.6]} scale={[4.6, 2.3, 3.1]} color="#e93f97" />
      <InkBox position={[11.2, 1.0, 6.4]} scale={[4.4, 2.0, 3.4]} color="#4a82d9" />
      <InkBox position={[-2.2, 0.72, -2.1]} scale={[4.6, 1.45, 2.4]} color="#55c8c0" />
      <InkBox position={[3.9, 0.62, 5.2]} scale={[3.2, 1.24, 2.35]} color="#f08d3f" />
      <InkBox position={[-4.8, 0.52, 7.3]} scale={[2.2, 1.04, 2.2]} color="#73c55c" />
      <InkBox position={[0.7, 0.42, 8.9]} scale={[1.8, 0.84, 1.8]} color="#f0b83f" />
      <InkBox position={[6.6, 0.55, -5.1]} scale={[3.6, 1.1, 2.0]} color="#49b8c8" />
      <InkBox position={[-3.2, 0.45, -8.9]} scale={[2.9, 0.9, 2.0]} color="#f39a38" />

      {/* Floating grapple platforms */}
      <InkBox position={[-7.1, 4.8, 2.5]} scale={[5.6, 0.42, 2.1]} color="#2cb5c4" rotation={[0, 0, -0.08]} />
      <InkBox position={[6.7, 5.5, -5.9]} scale={[6.0, 0.48, 2.1]} color="#e1a42a" rotation={[0, 0, 0.12]} />
      <InkBox position={[10.9, 4.15, 8.7]} scale={[4.8, 0.42, 2.0]} color="#e1a42a" rotation={[0, 0, -0.09]} />
      <InkBox position={[-12.1, 3.8, -9.4]} scale={[4.2, 0.42, 1.8]} color="#46b9c7" rotation={[0, 0, 0.1]} />
    </>
  )
}
