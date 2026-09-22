import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { BufferGeometry, Group, LineBasicMaterial, MathUtils, Mesh, PerspectiveCamera, Quaternion, Raycaster, Vector2, Vector3 } from 'three'
import { useGame } from './store'
import { useMobileInput } from './mobileInput'

const UP = new Vector3(0, 1, 0)

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const lineGeometry = useRef<BufferGeometry>(null)
  const hookHead = useRef<Group>(null)
  const ropeA = useRef<Mesh>(null)
  const ropeB = useRef<Mesh>(null)
  const { camera, scene } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera
  const keys = useRef(new Set<string>())
  const grappleTarget = useRef<Vector3 | null>(null)
  const hookStart = useRef(new Vector3())
  const hookTip = useRef(new Vector3())
  const hookFlying = useRef(false)
  const hookAttached = useRef(false)
  const hookFlightStarted = useRef(0)
  const hookFlightDuration = useRef(0.14)
  const ropeLength = useRef(0)
  const lastDash = useRef(0)
  const lastGrapple = useRef(0)
  const dashPulse = useRef(0)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const seenDash = useRef(0)
  const seenHook = useRef(0)
  const raycaster = useMemo(() => new Raycaster(), [])
  const lineMaterial = useMemo(() => new LineBasicMaterial({ color: '#6f4a2b', linewidth: 2 }), [])
  const hookRotation = useMemo(() => new Quaternion(), [])
  const ropeRotation = useMemo(() => new Quaternion(), [])
  const phase = useGame((s) => s.phase)

  const updateRopeSegment = (mesh: Mesh | null, start: Vector3, end: Vector3) => {
    if (!mesh) return
    const direction = end.clone().sub(start)
    const length = direction.length()
    if (length < 0.001) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.position.copy(start).add(end).multiplyScalar(0.5)
    ropeRotation.setFromUnitVectors(UP, direction.clone().normalize())
    mesh.quaternion.copy(ropeRotation)
    mesh.scale.set(1, length, 1)
  }

  const clearHook = () => {
    grappleTarget.current = null
    hookFlying.current = false
    hookAttached.current = false
    if (hookHead.current) hookHead.current.visible = false
    if (ropeA.current) ropeA.current.visible = false
    if (ropeB.current) ropeB.current.visible = false
  }

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

      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && performance.now() - lastDash.current > 430) {
        lastDash.current = performance.now()
        dashPulse.current = 1
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        forward.y = 0
        forward.normalize()
        const right = new Vector3().crossVectors(forward, UP).normalize()
        const dashDir = new Vector3()
        if (keys.current.has('KeyW')) dashDir.add(forward)
        if (keys.current.has('KeyS')) dashDir.sub(forward)
        if (keys.current.has('KeyD')) dashDir.add(right)
        if (keys.current.has('KeyA')) dashDir.sub(right)
        if (dashDir.lengthSq() === 0) dashDir.copy(forward)
        dashDir.normalize()
        const v = rb.linvel()
        rb.setLinvel({ x: dashDir.x * 20.5, y: Math.max(v.y, 0.7), z: dashDir.z * 20.5 }, true)
      }

      if (event.code === 'KeyQ' || event.code === 'KeyE') {
        if (hookFlying.current || hookAttached.current) {
          clearHook()
          return
        }
        const cooldown = useGame.getState().stats.grappleCooldown * 1000
        if (performance.now() - lastGrapple.current < cooldown) return
        lastGrapple.current = performance.now()
        raycaster.setFromCamera(new Vector2(0, 0), perspectiveCamera)
        raycaster.far = 30
        const hit = raycaster.intersectObjects(scene.children, true).find(
          (i) => !i.object.userData.enemyPart && (i.object.userData.grapple === true || i.object.userData.paintable === true),
        )
        if (hit) {
          const start = camera.position.clone().add(new Vector3(0.4, -0.34, -0.52).applyQuaternion(camera.quaternion))
          grappleTarget.current = hit.point.clone()
          hookStart.current.copy(start)
          hookTip.current.copy(start)
          hookFlightStarted.current = performance.now()
          hookFlightDuration.current = MathUtils.clamp(start.distanceTo(hit.point) / 85, 0.09, 0.22)
          hookFlying.current = true
          hookAttached.current = false
        }
      }
    }

    const onUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
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
      if (mobile.dashPulse !== seenDash.current) {
        seenDash.current = mobile.dashPulse
        if (performance.now() - lastDash.current > 430) {
          lastDash.current = performance.now()
          dashPulse.current = 1
          const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
          forward.y = 0
          forward.normalize()
          const right = new Vector3().crossVectors(forward, UP).normalize()
          const dashDir = new Vector3()
          dashDir.addScaledVector(forward, mobile.moveY)
          dashDir.addScaledVector(right, mobile.moveX)
          if (dashDir.lengthSq() < 0.04) dashDir.copy(forward)
          dashDir.normalize()
          rb.setLinvel({
            x: dashDir.x * 20.5,
            y: Math.max(velocity.y, 0.7),
            z: dashDir.z * 20.5,
          }, true)
        }
      }

      if (mobile.hookPulse !== seenHook.current) {
        seenHook.current = mobile.hookPulse
        if (hookFlying.current || hookAttached.current) {
          clearHook()
        } else {
          const cooldown = useGame.getState().stats.grappleCooldown * 1000
          if (performance.now() - lastGrapple.current >= cooldown) {
            lastGrapple.current = performance.now()
            raycaster.setFromCamera(new Vector2(0, 0), perspectiveCamera)
            raycaster.far = 30
            const hit = raycaster.intersectObjects(scene.children, true).find(
              (i) => !i.object.userData.enemyPart && (i.object.userData.grapple === true || i.object.userData.paintable === true),
            )
            if (hit) {
              const start = camera.position.clone().add(new Vector3(0.4, -0.34, -0.52).applyQuaternion(camera.quaternion))
              grappleTarget.current = hit.point.clone()
              hookStart.current.copy(start)
              hookTip.current.copy(start)
              hookFlightStarted.current = performance.now()
              hookFlightDuration.current = MathUtils.clamp(start.distanceTo(hit.point) / 85, 0.09, 0.22)
              hookFlying.current = true
              hookAttached.current = false
            }
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

    const targetFov = hookAttached.current ? 101 : hookFlying.current ? 96 : dashPulse.current > 0.01 ? 101 : 88
    perspectiveCamera.fov = MathUtils.lerp(perspectiveCamera.fov, targetFov, 1 - Math.exp(-10 * delta))
    perspectiveCamera.updateProjectionMatrix()
    dashPulse.current = Math.max(0, dashPulse.current - delta * 4.8)

    if (performance.now() < useGame.getState().hitStopUntil) {
      rb.setLinvel({
        x: velocity.x * 0.45,
        y: velocity.y * 0.45,
        z: velocity.z * 0.45,
      }, true)
      return
    }

    if (phase !== 'wave' || (!mobile.active && document.pointerLockElement == null)) {
      rb.setLinvel({ x: velocity.x * 0.86, y: velocity.y, z: velocity.z * 0.86 }, true)
      return
    }

    const target = grappleTarget.current
    const ropeOrigin = camera.position.clone().add(new Vector3(0.4, -0.34, -0.52).applyQuaternion(camera.quaternion))

    if (!target && lineGeometry.current) {
      lineGeometry.current.setFromPoints([new Vector3(0, -100, 0), new Vector3(0, -100, 0)])
      if (hookHead.current) hookHead.current.visible = false
      if (ropeA.current) ropeA.current.visible = false
      if (ropeB.current) ropeB.current.visible = false
    }

    if (target && hookFlying.current) {
      const flight = Math.min(1, (performance.now() - hookFlightStarted.current) / (hookFlightDuration.current * 1000))
      const eased = 1 - Math.pow(1 - flight, 3)
      hookTip.current.copy(hookStart.current).lerp(target, eased)

      if (hookHead.current) {
        hookHead.current.visible = true
        hookHead.current.position.copy(hookTip.current)
        const direction = target.clone().sub(ropeOrigin).normalize()
        hookRotation.setFromUnitVectors(new Vector3(0, 0, 1), direction)
        hookHead.current.quaternion.copy(hookRotation)
      }

      const mid = ropeOrigin.clone().lerp(hookTip.current, 0.5)
      mid.y -= ropeOrigin.distanceTo(hookTip.current) * 0.03
      lineGeometry.current?.setFromPoints([ropeOrigin, mid, hookTip.current])
      updateRopeSegment(ropeA.current, ropeOrigin, mid)
      updateRopeSegment(ropeB.current, mid, hookTip.current)

      if (flight >= 1) {
        hookFlying.current = false
        hookAttached.current = true
        const playerPos = new Vector3(p.x, p.y + 0.48, p.z)
        ropeLength.current = Math.max(3.4, playerPos.distanceTo(target) * 0.9)
      }
    }

    if (target && hookAttached.current) {
      if (hookHead.current) {
        hookHead.current.visible = true
        hookHead.current.position.copy(target)
      }

      const pos = new Vector3(p.x, p.y + 0.48, p.z)
      const toAnchor = target.clone().sub(pos)
      const distance = toAnchor.length()

      if (distance < 1.5) {
        clearHook()
      } else {
        const dir = toAnchor.normalize()
        const currentVelocity = new Vector3(velocity.x, velocity.y, velocity.z)

        ropeLength.current = Math.max(3.2, ropeLength.current - delta * 5.8)

        const radialSpeed = currentVelocity.dot(dir)
        const stretch = Math.max(0, distance - ropeLength.current)
        const reelPull = 4.2 + Math.max(0, ropeLength.current - 3.2) * 0.22
        const desiredRadial = Math.min(20.5, reelPull + stretch * 6.2)

        if (radialSpeed < desiredRadial) {
          currentVelocity.addScaledVector(dir, (desiredRadial - radialSpeed) * Math.min(1, delta * 10.5))
        }

        const forwardAir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        forwardAir.y = 0
        forwardAir.normalize()
        const rightAir = new Vector3().crossVectors(forwardAir, UP).normalize()
        const steer = new Vector3()

        if (keys.current.has('KeyW')) steer.add(forwardAir)
        if (keys.current.has('KeyS')) steer.sub(forwardAir)
        if (keys.current.has('KeyD')) steer.add(rightAir)
        if (keys.current.has('KeyA')) steer.sub(rightAir)
        if (mobile.active) {
          steer.addScaledVector(forwardAir, mobile.moveY)
          steer.addScaledVector(rightAir, mobile.moveX)
        }

        if (steer.lengthSq() > 0) {
          steer.normalize()
          const radialComponent = dir.clone().multiplyScalar(steer.dot(dir))
          steer.sub(radialComponent).normalize()
          currentVelocity.addScaledVector(steer, 2.6)
        }

        rb.setLinvel({
          x: currentVelocity.x,
          y: currentVelocity.y,
          z: currentVelocity.z,
        }, true)
      }

      const mid = ropeOrigin.clone().lerp(target, 0.5)
      mid.y -= Math.max(0.04, ropeOrigin.distanceTo(target) * 0.012)
      lineGeometry.current?.setFromPoints([ropeOrigin, mid, target])
      updateRopeSegment(ropeA.current, ropeOrigin, mid)
      updateRopeSegment(ropeB.current, mid, target)
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
      <line visible={false}>
        <bufferGeometry ref={lineGeometry} />
        <primitive object={lineMaterial} attach="material" />
      </line>

      <mesh ref={ropeA} visible={false}>
        <cylinderGeometry args={[0.026, 0.026, 1, 10]} />
        <meshBasicMaterial color="#8a5c32" />
      </mesh>
      <mesh ref={ropeB} visible={false}>
        <cylinderGeometry args={[0.026, 0.026, 1, 10]} />
        <meshBasicMaterial color="#8a5c32" />
      </mesh>

      <group ref={hookHead} visible={false} scale={1.25}>
        <mesh position={[0, 0, -0.12]}>
          <cylinderGeometry args={[0.035, 0.045, 0.28, 8]} />
          <meshBasicMaterial color="#24212a" />
        </mesh>
        <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.105, 0.026, 7, 18, Math.PI * 1.25]} />
          <meshBasicMaterial color="#24212a" />
        </mesh>
        <mesh position={[-0.102, 0, 0.075]} rotation={[0, 0.35, -0.78]}>
          <coneGeometry args={[0.04, 0.18, 6]} />
          <meshBasicMaterial color="#24212a" />
        </mesh>
        <mesh position={[0.102, 0, 0.075]} rotation={[0, -0.35, 0.78]}>
          <coneGeometry args={[0.04, 0.18, 6]} />
          <meshBasicMaterial color="#24212a" />
        </mesh>
        <mesh position={[0, 0, -0.29]}>
          <cylinderGeometry args={[0.045, 0.058, 0.14, 8]} />
          <meshBasicMaterial color="#f1c63c" />
        </mesh>
      </group>
    </>
  )
}
