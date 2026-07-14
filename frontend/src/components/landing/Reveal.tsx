'use client'
import { useEffect, useRef, useState, createElement } from 'react'
import type { ReactNode, ElementType } from 'react'

// Maps the `delay` prop (0-6) to the reveal-delay-N classes already
// defined in landing.css, so cards in the same grid stagger in.
const DELAY_CLASSES = [
    '',
    'reveal-delay-1',
    'reveal-delay-2',
    'reveal-delay-3',
    'reveal-delay-4',
    'reveal-delay-5',
    'reveal-delay-6',
]

interface RevealProps {
    children: ReactNode
    /** Stagger index, 0-6. 0 = no delay. */
    delay?: number
    /** Use the gentler reveal-soft variant (for big panels/CTA boxes). */
    soft?: boolean
    /** Which element to render, defaults to 'div'. Use 'article' for cards. */
    as?: ElementType
    className?: string
}

export default function Reveal({
    children,
    delay = 0,
    soft = false,
    as = 'div',
    className = '',
}: RevealProps) {
    const ref = useRef<HTMLElement | null>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        // Respect reduced-motion users — just show immediately
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setVisible(true)
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.disconnect() // animate once, not every scroll
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const baseClass = soft ? 'reveal-soft' : 'reveal'
    const classes = [baseClass, DELAY_CLASSES[delay] || '', visible ? 'is-visible' : '', className]
        .filter(Boolean)
        .join(' ')

    return createElement(as, { ref, className: classes }, children)
}