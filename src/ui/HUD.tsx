import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useGame, type PerkId } from '../game/store'

const PERKS: { id: PerkId; title: string; desc: string; icon: string; tone: string }[] = [
  { id: 'longBlade', title: 'LONG BLADE', desc: 'Katana attack range + damage', icon: '◆', tone: 'purple' },
  { id: 'thickSkin', title: 'THICK SKIN', desc: 'Max HP +25 and restore health', icon: '◆', tone: 'blue' },
  { id: 'splashZone', title: 'SPLASH ZONE', desc: 'Paint splashes cover more space', icon: '→', tone: 'orange' },
  { id: 'doubleTap', title: 'DOUBLE TAP', desc: 'Chance to fire an extra paint shot', icon: 'Ⅱ', tone: 'purple' },
  { id: 'grappleMaster', title: 'GRAPPLE MASTER', desc: 'Grapple recharges much faster', icon: '↗', tone: 'blue' },
  { id: 'rush', title: 'RUSH', desc: 'Move faster through the arena', icon: '»', tone: 'orange' },
]

export function HUD() {
  const phase = useGame((s) => s.phase)
  const wave = useGame((s) => s.wave)
  const maxWave = useGame((s) => s.maxWave)
  const hp = useGame((s) => s.hp)
  const maxHp = useGame((s) => s.maxHp)
  const paint = useGame((s) => s.paint)
  const maxPaint = useGame((s) => s.maxPaint)
  const score = useGame((s) => s.score)
  const alive = useGame((s) => s.aliveEnemies)
  const hitPulse = useGame((s) => s.hitPulse)
  const hitColor = useGame((s) => s.hitColor)
  const startGame = useGame((s) => s.startGame)
  const restart = useGame((s) => s.restart)
  const choosePerk = useGame((s) => s.choosePerk)

  const [combatText, setCombatText] = useState('')
  const [showHit, setShowHit] = useState(false)
  const [locked, setLocked] = useState(document.pointerLockElement != null)
  const [touchMode] = useState(() => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
  const [waveIntro, setWaveIntro] = useState(true)
  const prevScore = useRef(0)

  const perkChoices = useMemo(() => {
    const start = ((wave - 1) * 2) % PERKS.length
    return [PERKS[start], PERKS[(start + 1) % PERKS.length], PERKS[(start + 2) % PERKS.length]]
  }, [wave])

  useEffect(() => {
    if (phase !== 'wave') return
    setWaveIntro(true)
    const t = window.setTimeout(() => setWaveIntro(false), 1350)
    return () => window.clearTimeout(t)
  }, [phase, wave])

  useEffect(() => {
    if (score <= prevScore.current) {
      prevScore.current = score
      return
    }
    const delta = score - prevScore.current
    prevScore.current = score
    setCombatText(delta >= 150 ? 'HEADSHOT!' : 'SPLAT!')
    const t = window.setTimeout(() => setCombatText(''), 560)
    return () => window.clearTimeout(t)
  }, [score])

  useEffect(() => {
    if (!hitPulse) return
    setShowHit(true)
    const t = window.setTimeout(() => setShowHit(false), 310)
    return () => window.clearTimeout(t)
  }, [hitPulse])

  useEffect(() => {
    if (phase !== 'wave' && document.pointerLockElement) document.exitPointerLock()
  }, [phase])

  useEffect(() => {
    const sync = () => setLocked(document.pointerLockElement != null)
    document.addEventListener('pointerlockchange', sync)
    return () => document.removeEventListener('pointerlockchange', sync)
  }, [])

  const requestLock = () => {
    if (touchMode) return
    document.querySelector('canvas')?.requestPointerLock?.()
  }
  const start = () => {
    startGame()
    window.setTimeout(requestLock, 40)
  }
  const playAgain = () => {
    restart()
    useGame.getState().startGame()
    window.setTimeout(requestLock, 40)
  }

  return (
    <div className="hud-root">
      <div className="paper-grain" />
      {showHit && (
        <div className="screen-splats" style={{ '--hit': hitColor } as CSSProperties}>
          <i /><i /><i /><i /><i />
        </div>
      )}

      {phase !== 'ready' && phase !== 'dead' && phase !== 'victory' && (
        <>
          <div className="status-stack">
            <div className="tiny-label">HP</div>
            <div className="ref-meter hp"><span style={{ width: `${(hp / maxHp) * 100}%` }} /></div>
            <div className="tiny-label">PAINT</div>
            <div className="ref-meter paint"><span style={{ width: `${(paint / maxPaint) * 100}%` }} /></div>
          </div>

          <div className="wave-mini">WAVE {wave}<small>{alive} LEFT</small></div>
          <div className="life-pips">◠◠◠◠</div>
          <div className="score-ref">{score.toString().padStart(6, '0')}</div>

          <div className="crosshair-ref"><i /><b /><em /><span /></div>
          <div className="ability-row">
            <div className="ability yellow">↻<small>DASH</small></div>
            <div className="ability cyan">↗<small>GRAPPLE</small></div>
          </div>

          {combatText && <div className="combat-text">{combatText}</div>}
          {alive === 0 && phase === 'wave' && <div className="wave-clear">WAVE CLEARED<small>+100</small></div>}
          {waveIntro && phase === 'wave' && <div className="wave-intro">WAVE {wave}<small>PAINT STOP</small></div>}
        </>
      )}

      {phase === 'wave' && !touchMode && !locked && (
        <div className="pause-overlay">
          <div className="notebook pause-card">
            <div className="pause-accent" />
            <div className="pause-title">PAUSED</div>
            <div className="pause-sub">THE PAGE IS HOLDING ITS BREATH</div>
            <div className="pause-controls">
              <span><b>MOUSE</b> look</span><span><b>WASD</b> move</span>
              <span><b>LEFT CLICK</b> fire the paint gun</span><span><b>RIGHT CLICK</b> katana / parry</span>
              <span><b>SHIFT</b> dash</span><span><b>Q / E</b> grapple</span>
              <span><b>SPACE</b> jump / grapple launch</span><span><b>ESC</b> release mouse</span>
            </div>
            <button onClick={requestLock}>CLICK TO RESUME</button>
          </div>
          <kbd>ESC</kbd>
        </div>
      )}

      {phase === 'ready' && (
        <div className="modal start-modal">
          <div className="scribble">REFERENCE BUILD // VIDEO MATCH PASS</div>
          <h1>PAINT<br /><em>RUSH</em></h1>
          <p>Fast arena FPS with paint, katana attacks and grapple-launch movement.</p>
          <button onClick={start}>{touchMode ? 'TAP TO PLAY' : 'CLICK TO PLAY'}</button>
        </div>
      )}

      {phase === 'perk' && (
        <div className="perk-overlay notebook">
          <div className="perk-title">PICK A PERK</div>
          <div className="perk-sub">PERK {Math.min(wave, 3)} OF 3</div>
          <div className="perk-grid">
            {perkChoices.map((perk, index) => (
              <button key={perk.id} className={`perk-card ${perk.tone}`} onClick={() => choosePerk(perk.id)}>
                <span className="perk-number">{index + 1}</span>
                <strong>{perk.title}</strong>
                <p>{perk.desc}</p>
                <span className="perk-icon">{perk.icon}</span>
                <small>READY</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'dead' && (
        <div className="modal end-modal">
          <div className="scribble">YOU GOT PAINTED.</div>
          <h2>RUN OVER</h2>
          <p>Reached wave {wave}/{maxWave} · Score {score}</p>
          <button onClick={playAgain}>TRY AGAIN</button>
        </div>
      )}

      {phase === 'victory' && (
        <div className="modal end-modal victory">
          <div className="scribble">ALL WAVES CLEARED</div>
          <h2>PAINT<br />EVERYWHERE.</h2>
          <p>Score {score}</p>
          <button onClick={playAgain}>RUN IT BACK</button>
        </div>
      )}
    </div>
  )
}
