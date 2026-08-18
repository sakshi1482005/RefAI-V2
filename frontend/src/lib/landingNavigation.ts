export const HOW_IT_WORKS_SECTION_ID = 'how-it-works'
export const HOW_IT_WORKS_PATH = `/#${HOW_IT_WORKS_SECTION_ID}`

export function scrollToLandingSection(sectionId: string) {
  const target = document.getElementById(sectionId)
  if (!target) return false

  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
  return true
}
