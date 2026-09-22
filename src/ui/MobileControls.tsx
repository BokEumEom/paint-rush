import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useGame } from '../game/store'
import { useMobileInput } from '../game/mobileInput'

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

export function MobileControls() {
  const phase = useGame((s) => s.phase)
  const [enabled, setEnabled] = useState(isTouchDevice)
  const joystickPointer = useRef<number | null>(null)
  const lookPointer = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const sync = () => setEnabled(isTouchDevice())
    media.addEventListener?.('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      media.removeEventListener?.('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  useEffect(() => {
    useMobileInput.getState().setActive(enabled)
    document.documentElement.classList.toggle('touch-game', enabled)
    return () => {
      useMobileInput.getState().reset()
      useMobileInput.getState().setActive(false)
      document.documentElement.classList.remove('touch-game')
    }
  }, [enabled])

  useEffect(() => {
    if (phase !== 'wave') useMobileInput.getState().reset()
  }, [phase])

  if (!enabled || phase !== 'wave') return null

  const updateStick = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const max = rect.width * 0.34
    let dx = clientX - cx
    let dy = clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > max) {
      dx = (dx / len) * max
      dy = (dy / len) * max
    }
    setKnob({ x: dx, y: dy })
    useMobileInput.getState().setMove(dx / max, -dy / max)
  }

  const stickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    joystickPointer.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    updateStick(e.currentTarget, e.clientX, e.clientY)
  }
  const stickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return
    e.preventDefault()
    updateStick(e.currentTarget, e.clientX, e.clientY)
  }
  const stickUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return
    joystickPointer.current = null
    setKnob({ x: 0, y: 0 })
    useMobileInput.getState().setMove(0, 0)
  }

  const lookDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    lookPointer.current = e.pointerId
    lookLast.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const lookMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointer.current !== e.pointerId) return
    e.preventDefault()
    const dx = e.clientX - lookLast.current.x
    const dy = e.clientY - lookLast.current.y
    lookLast.current = { x: e.clientX, y: e.clientY }
    useMobileInput.getState().addLook(dx, dy)
  }
  const lookUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointer.current === e.pointerId) lookPointer.current = null
  }

  const fireDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    useMobileInput.getState().setFireHeld(true)
  }
  const fireUp = () => useMobileInput.getState().setFireHeld(false)

  return (
    <div className="mobile-controls" aria-label="Mobile game controls">
      <div
        className="mobile-look-zone"
        onPointerDown={lookDown}
        onPointerMove={lookMove}
        onPointerUp={lookUp}
        onPointerCancel={lookUp}
      />
      <div
        className="move-stick"
        onPointerDown={stickDown}
        onPointerMove={stickMove}
        onPointerUp={stickUp}
        onPointerCancel={stickUp}
      >
        <div className="move-stick-ring" />
        <div className="move-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        <small>MOVE</small>
      </div>

      <button className="touch-action fire" onPointerDown={fireDown} onPointerUp={fireUp} onPointerCancel={fireUp}>
        FIRE
      </button>
      <button className="touch-action blade" onPointerDown={(e) => { e.preventDefault(); useMobileInput.getState().blade() }}>
        BLADE
      </button>
      <button className="touch-action dash" onPointerDown={(e) => { e.preventDefault(); useMobileInput.getState().dash() }}>
        DASH
      </button>
      <button className="touch-action hook" onPointerDown={(e) => { e.preventDefault(); useMobileInput.getState().hook() }}>
        HOOK
      </button>
    </div>
  )
}
