import { useEffect } from 'react'

export function useSectionReveal() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('#main-content section'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('section-revealed'))
      return
    }
    sections.forEach((section) => section.classList.add('section-reveal'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('section-revealed'); observer.unobserve(entry.target) }
      })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
}
