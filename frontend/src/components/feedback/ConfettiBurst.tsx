import { useEffect, useState, type CSSProperties } from 'react'

const pieces = Array.from({ length: 18 }, (_, index) => ({
  left: 12 + ((index * 37) % 76),
  delay: (index % 6) * 45,
  drift: -48 + ((index * 29) % 96),
  rotate: 90 + ((index * 47) % 240),
}))

export default function ConfettiBurst({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [visible, setVisible] = useState(active)
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setVisible(true)
    const timeout = window.setTimeout(() => { setVisible(false); onComplete?.() }, 1700)
    return () => window.clearTimeout(timeout)
  }, [active, onComplete])
  if (!visible || !active) return null
  return <div className="confetti-burst" aria-hidden="true">{pieces.map((piece, index) => <span key={index} className={`confetti-piece confetti-piece-${index % 4}`} style={{ '--confetti-left': `${piece.left}%`, '--confetti-delay': `${piece.delay}ms`, '--confetti-drift': `${piece.drift}px`, '--confetti-rotate': `${piece.rotate}deg` } as CSSProperties} />)}</div>
}
