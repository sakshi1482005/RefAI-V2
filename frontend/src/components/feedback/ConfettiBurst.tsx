import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const PIECE_COUNT = 120

const pieces = Array.from({ length: PIECE_COUNT }, (_, index) => ({
  left: 1 + ((index * 13) % 98),
  delay: (index % 12) * 55,
  drift: -140 + ((index * 23) % 280),
  rotate: 180 + ((index * 41) % 720),
  duration: 1900 + ((index * 67) % 1400),
  scale: 0.7 + ((index * 19) % 60) / 100,
}))

export default function ConfettiBurst({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [visible, setVisible] = useState(active)
  useEffect(() => {
    if (!active) { setVisible(false); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false)
      onComplete?.()
      return
    }
    setVisible(true)
    const timeout = window.setTimeout(() => { setVisible(false); onComplete?.() }, 3600)
    return () => window.clearTimeout(timeout)
  }, [active, onComplete])
  if (!visible || !active) return null
  return createPortal(
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={`confetti-piece confetti-piece-${index % 6}`}
          style={{
            '--confetti-left': `${piece.left}%`,
            '--confetti-delay': `${piece.delay}ms`,
            '--confetti-drift': `${piece.drift}px`,
            '--confetti-rotate': `${piece.rotate}deg`,
            '--confetti-duration': `${piece.duration}ms`,
            '--confetti-scale': piece.scale,
          } as CSSProperties}
        />
      ))}
    </div>,
    document.body
  )
}