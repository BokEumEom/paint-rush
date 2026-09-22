import { create } from 'zustand'

export type GamePhase = 'ready' | 'wave' | 'perk' | 'dead' | 'victory'

export type PerkId =
  | 'longBlade'
  | 'thickSkin'
  | 'splashZone'
  | 'doubleTap'
  | 'grappleMaster'
  | 'rush'

export type PlayerStats = {
  gunDamage: number
  swordDamage: number
  swordRange: number
  moveSpeed: number
  grappleForce: number
  grappleCooldown: number
  splashRadius: number
  doubleTapChance: number
}

type GameState = {
  phase: GamePhase
  wave: number
  maxWave: number
  score: number
  hp: number
  maxHp: number
  paint: number
  maxPaint: number
  aliveEnemies: number
  hitPulse: number
  hitColor: string
  shotPulse: number
  slashPulse: number
  stats: PlayerStats
  startGame: () => void
  restart: () => void
  setPhase: (phase: GamePhase) => void
  setAliveEnemies: (count: number) => void
  enemyKilled: (headshot: boolean) => void
  damagePlayer: (amount: number, color?: string) => void
  consumePaint: (amount: number) => boolean
  refillPaint: (amount?: number) => void
  triggerShot: () => void
  triggerSlash: () => void
  choosePerk: (perk: PerkId) => void
}

const baseStats: PlayerStats = {
  gunDamage: 34,
  swordDamage: 58,
  swordRange: 3.3,
  moveSpeed: 7.5,
  grappleForce: 22,
  grappleCooldown: 0.45,
  splashRadius: 0.45,
  doubleTapChance: 0,
}

const initial = {
  phase: 'ready' as GamePhase,
  wave: 1,
  maxWave: 5,
  score: 0,
  hp: 100,
  maxHp: 100,
  paint: 100,
  maxPaint: 100,
  aliveEnemies: 0,
  hitPulse: 0,
  hitColor: '#7c3aed',
  shotPulse: 0,
  slashPulse: 0,
  stats: { ...baseStats },
}

export const useGame = create<GameState>((set, get) => ({
  ...initial,
  startGame: () => set({ phase: 'wave' }),
  restart: () => set({ ...initial, stats: { ...baseStats } }),
  setPhase: (phase) => set({ phase }),
  setAliveEnemies: (aliveEnemies) => set({ aliveEnemies }),
  enemyKilled: (headshot) =>
    set((s) => ({
      score: s.score + (headshot ? 150 : 100),
      aliveEnemies: Math.max(0, s.aliveEnemies - 1),
    })),
  damagePlayer: (amount, color = '#7c3aed') => {
    const nextHp = Math.max(0, get().hp - amount)
    set((s) => ({
      hp: nextHp,
      phase: nextHp <= 0 ? 'dead' : s.phase,
      hitPulse: s.hitPulse + 1,
      hitColor: color,
    }))
  },
  consumePaint: (amount) => {
    const { paint, phase } = get()
    if (phase !== 'wave' || paint < amount) return false
    set({ paint: paint - amount })
    return true
  },
  refillPaint: (amount) =>
    set((s) => ({ paint: Math.min(s.maxPaint, amount == null ? s.maxPaint : s.paint + amount) })),
  triggerShot: () => set((s) => ({ shotPulse: s.shotPulse + 1 })),
  triggerSlash: () => set((s) => ({ slashPulse: s.slashPulse + 1 })),
  choosePerk: (perk) => {
    const s = get()
    const stats = { ...s.stats }
    let maxHp = s.maxHp
    let hp = s.hp

    if (perk === 'longBlade') {
      stats.swordRange += 0.65
      stats.swordDamage += 10
    }
    if (perk === 'thickSkin') {
      maxHp += 25
      hp = Math.min(maxHp, hp + 25)
    }
    if (perk === 'splashZone') stats.splashRadius += 0.2
    if (perk === 'doubleTap') stats.doubleTapChance = Math.min(0.5, stats.doubleTapChance + 0.25)
    if (perk === 'grappleMaster') stats.grappleCooldown = Math.max(0.15, stats.grappleCooldown - 0.12)
    if (perk === 'rush') stats.moveSpeed += 0.7

    const nextWave = s.wave + 1
    set({
      stats,
      maxHp,
      hp,
      wave: nextWave,
      paint: s.maxPaint,
      phase: nextWave > s.maxWave ? 'victory' : 'wave',
    })
  },
}))
