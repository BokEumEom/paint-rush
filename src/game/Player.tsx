import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { BufferGeometry, LineBasicMaterial, MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { useGame } from './store'
import { useMobileInput } from './mobileInput'

const UP = new Vector3(0, 1, 0)

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const lineGeometry = useRef<BufferGeometry>(null)
  const { camera, scene } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera
  const keys = useRef(new Set<string>())
  const grappleTarget = useRef<Vector3 | null>(null)
  const lastDash = useRef(0)
  const lastGrapple = useRef(0)
  const dashPulse = useRef(0)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const seenJump = useRef(0)
  const seenDash = useRef(0)
  const seenGrapple = useRef(0)
  const raycaster = useMemo(() => new Raycaster(), [])
  const lineMaterial = useMemo(() => new LineBasicMaterial({ color: '#24212a', linewidth: 2 }), [])
  const phase = useGame((s) => s.phase)

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      keys.current.add(event.code)
      const rb = body.current
      if (!rb || useGame.getState().phase !== 'wave' || (document.pointerLockElement == null && !useMobileInput.getState().active)) return

      if (event.code === 'Space') {
        const velocity = rb.linvel()
        const target = grappleTarget.current
        if (target) {
          const p = rb.translation()
          const dir = new Vector3(target.x - p.x, target.y - p.y, target.z - p.z).normalize()
          const launch = useGame.getState().stats.grappleForce * 1.18
          rb.setLinvel({ x: dir.x * launch, y: Math.max(8, dir.y * launch + 5), z: dir.z * launch }, true)
          grappleTarget.current = null
        } else if (Math.abs(velocity.y) < 0.24) {
          rb.setLinvel({ x: velocity.x, y: 7.4, z: velocity.z }, true)
        }
      }

      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && performance.now() - lastDash.current > 520) {
        lastDash.current = performance.now()
        dashPulse.current = 1
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        forward.y = 0
        if (forward.lengthSq() > 0) forward.normalize()
        const v = rb.linvel()
        rb.setLinvel({ x: forward.x * 19, y: Math.max(v.y, 1), z: forward.z * 19 }, true)
      }

      if (event.code === 'KeyQ' || event.code === 'KeyE') {
        const cooldown = useGame.getState().stats.grappleCooldown * 1000
        if (performance.now() - lastGrapple.current < cooldown) return
        lastGrapple.current = performance.now()
        raycaster.setFromCamera(new Vector2(0, 0), perspectiveCamera)
        raycaster.far = 25
        const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.grapple === true)
        if (hit) grappleTarget.current = hit.point.clone()
      }
    }

    const onUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
      if (event.code === 'KeyQ' || event.code === 'KeyE') grappleTarget.current = null
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [camera, raycaster, scene])

  useFrame((state, delta) => {
    const rb = body.current
    if (!rb) return

    const mobile = useMobileInput.getState()
    if (mobile.active) {
      const look = mobile.consumeLook()
      yaw.current -= look.x * 0.0042
      pitch.current = MathUtils.clamp(pitch.current - look.y * 0.0038, -1.35, 1.35)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(pitch.current, yaw.current, 0)
    }

    const p = rb.translation()
    const velocity = rb.linvel()

    if (mobile.active && phase === 'wave') {
      if (mobile.jumpPulse !== seenJump.current) {
        seenJump.current = mobile.jumpPulse
        const target = grappleTarget.current
        if (target) {
          const dir = new Vector3(target.x - p.x, target.y - p.y, target.z - p.z).normalize()
          const launch = useGame.getState().stats.grappleForce * 1.18
          rb.setLinvel({ x: dir.x * launch, y: Math.max(8, dir.y * launch + 5), z: dir.z * launch }, true)
          grappleTarget.current = null
        } else if (Math.abs(velocity.y) < 0.28) {
          rb.setLinvel({ x: velocity.x, y: 7.4, z: velocity.z }, true)
        }
      }

      if (mobile.dashPulse !== seenDash.current) {
        seenDash.current = mobile.dashPulse
        if (performance.now() - lastDash.current > 520) {
          lastDash.current = performance.now()
          dashPulse.current = 1
          const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
          forward.y = 0
          if (forward.lengthSq() > 0) forward.normalize()
          rb.setLinvel({ x: forward.x * 19, y: Math.max(velocity.y, 1), z: forward.z * 19 }, true)
        }
      }

      if (mobile.grapplePulse !== seenGrapple.current) {
        seenGrapple.current = mobile.grapplePulse
        if (grappleTarget.current) {
          grappleTarget.current = null
        } else {
          const cooldown = useGame.getState().stats.grappleCooldown * 1000
          if (performance.now() - lastGrapple.current >= cooldown) {
            lastGrapple.current = performance.now()
            raycaster.setFromCamera(new Vector2(0, 0), perspectiveCamera)
            raycaster.far = 25
            const hit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData.grapple === true)
            if (hit) grappleTarget.current = hit.point.clone()
          }
        }
      }
    }

    const speed = Math.hypot(velocity.x, velocity.z)
    const inputActive = document.pointerLockElement != null || mobile.active
    const bob = phase === 'wave' && inputActive && speed > 1 ? Math.sin(state.clock.elapsedTime * 11) * 0.018 : 0
    camera.position.set(p.x, p.y + 0.63 + bob, p.z)

    if (p.y < -7) {
      rb.setTranslation({ x: 0, y: 2.5, z: 10.5 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }

    const targetFov = grappleTarget.current ? 104 : dashPulse.current > 0.01 ? 101 : 88
    perspectiveCamera.fov = MathUtils.lerp(perspectiveCamera.fov, targetFov, 1 - Math.exp(-10 * delta))
    perspectiveCamera.updateProjectionMatrix()
    dashPulse.current = Math.max(0, dashPulse.current - delta * 4.8)

    if (phase !== 'wave' || (!mobile.active && document.pointerLockElement == null)) {
      rb.setLinvel({ x: velocity.x * 0.86, y: velocity.y, z: velocity.z * 0.86 }, true)
      return
    }

    const target = grappleTarget.current
    if (!target && lineGeometry.current) {
      lineGeometry.current.setFromPoints([new Vector3(0, -100, 0), new Vector3(0, -100, 0)])
    }
    if (target) {
      const pos = new Vector3(p.x, p.y + 0.48, p.z)
      const dir = target.clone().sub(pos)
      if (dir.length() < 1.25) grappleTarget.current = null
      else {
        dir.normalize()
        const force = useGame.getState().stats.grappleForce
        rb.setLinvel({ x: dir.x * force, y: dir.y * force, z: dir.z * force }, true)
      }
      lineGeometry.current?.setFromPoints([camera.position.clone(), target])
      return
    }

    const stats = useGame.getState().stats
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    forward.y = 0
    forward.normalize()
    const right = new Vector3().crossVectors(forward, UP).normalize()
    const desired = new Vector3()
    if (keys.current.has('KeyW')) desired.add(forward)
    if (keys.current.has('KeyS')) desired.sub(forward)
    if (keys.current.has('KeyD')) desired.add(right)
    if (keys.current.has('KeyA')) desired.sub(right)
    if (mobile.active) {
      desired.addScaledVector(forward, mobile.moveY)
      desired.addScaledVector(right, mobile.moveX)
    }
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(stats.moveSpeed)

    const blend = 1 - Math.exp(-15 * delta)
    rb.setLinvel({
      x: velocity.x + (desired.x - velocity.x) * blend,
      y: velocity.y,
      z: velocity.z + (desired.z - velocity.z) * blend,
    }, true)
  })

  return (
    <>
      <RigidBody
        ref={body}
        position={[0, 2.4, 10.5]}
        colliders={false}
        enabledRotations={[false, false, false]}
        linearDamping={0.18}
        friction={0}
        gravityScale={1.65}
        canSleep={false}
      >
        <CapsuleCollider args={[0.62, 0.38]} />
      </RigidBody>
      <line>
        <bufferGeometry ref={lineGeometry} />
        <primitive object={lineMaterial} attach="material" />
      </line>
    </>
  )
}
