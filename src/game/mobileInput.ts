import { create } from 'zustand'

type MobileInputState = {
  active: boolean
  moveX: number
  moveY: number
  lookX: number
  lookY: number
  fireHeld: boolean
  jumpPulse: number
  dashPulse: number
  grapplePulse: number
  bladePulse: number
  setActive: (active: boolean) => void
  setMove: (x: number, y: number) => void
  addLook: (x: number, y: number) => void
  consumeLook: () => { x: number; y: number }
  setFireHeld: (held: boolean) => void
  jump: () => void
  dash: () => void
  grapple: () => void
  blade: () => void
  reset: () => void
}

export const useMobileInput = create<MobileInputState>((set, get) => ({
  active: false,
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  fireHeld: false,
  jumpPulse: 0,
  dashPulse: 0,
  grapplePulse: 0,
  bladePulse: 0,
  setActive: (active) => set({ active }),
  setMove: (moveX, moveY) => set({ moveX, moveY }),
  addLook: (x, y) => set((s) => ({ lookX: s.lookX + x, lookY: s.lookY + y })),
  consumeLook: () => {
    const { lookX: x, lookY: y } = get()
    if (x || y) set({ lookX: 0, lookY: 0 })
    return { x, y }
  },
  setFireHeld: (fireHeld) => set({ fireHeld }),
  jump: () => set((s) => ({ jumpPulse: s.jumpPulse + 1 })),
  dash: () => set((s) => ({ dashPulse: s.dashPulse + 1 })),
  grapple: () => set((s) => ({ grapplePulse: s.grapplePulse + 1 })),
  blade: () => set((s) => ({ bladePulse: s.bladePulse + 1 })),
  reset: () => set({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, fireHeld: false }),
}))
