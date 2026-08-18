import { useEffect, useRef } from 'react'
import { BadgeCheck, Lightbulb, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HOW_IT_WORKS_PATH, HOW_IT_WORKS_SECTION_ID, scrollToLandingSection } from '../../lib/landingNavigation'

const MAX_TILT = 4
const MAX_LIFT = 4
const NEUTRAL_TRANSFORM = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)'

const EXAMPLE_TARGET_COMPANIES = [
  'Atlassian · Associate Software Engineer',
  'Capgemini · Software Engineer',
  'Zoho · Backend Engineer',
  'Razorpay · Product Engineer',
]

export default function Hero() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const card = cardRef.current
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!stage || !card || !supportsHover || prefersReducedMotion) return

    let frame: number | null = null
    const applyParallax = (event: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const horizontal = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5))
      const vertical = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5))
      const rotateY = horizontal * MAX_TILT * 2
      const rotateX = vertical * -MAX_TILT * 2
      const liftX = horizontal * MAX_LIFT * 2
      const liftY = vertical * MAX_LIFT * 2

      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translate3d(${liftX.toFixed(1)}px, ${liftY.toFixed(1)}px, 0)`
        card.classList.add('is-tilting')
      })
    }
    const resetParallax = () => {
      if (frame) cancelAnimationFrame(frame)
      card.style.transform = NEUTRAL_TRANSFORM
      card.classList.remove('is-tilting')
    }

    stage.addEventListener('mousemove', applyParallax)
    stage.addEventListener('mouseleave', resetParallax)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      stage.removeEventListener('mousemove', applyParallax)
      stage.removeEventListener('mouseleave', resetParallax)
    }
  }, [])

  const renderCompanyMarqueeSet = (keyPrefix: string) => (
    <>
      {EXAMPLE_TARGET_COMPANIES.map((target, index) => (
        <span key={`${keyPrefix}-${index}`} className="logo-marquee-pair">
          <span className="logo-marquee-item">{target}</span>
          <span className="logo-marquee-dot">&#9670;</span>
        </span>
      ))}
    </>
  )

  return (
    <section className="hero">
      <div className="shell hero-grid">
        <div>
          <div className="eyebrow fade"><i></i> AI referral intelligence for student talent</div>
          <h1 className="fade delay-1">
            Turn your resume into an <em className="hero-serif-italic">evidence-backed</em> referral request.
          </h1>
          <p className="hero-copy fade delay-2">RefAI compares resumes with job descriptions, explains the resulting fit, and creates an AI Trust Card for a more structured referral review.</p>
          <div className="hero-actions fade delay-3">
            <Link className="btn btn-primary" to="/auth">Get Started</Link>
            <Link className="btn btn-secondary" to={HOW_IT_WORKS_PATH} aria-controls={HOW_IT_WORKS_SECTION_ID} onClick={() => scrollToLandingSection(HOW_IT_WORKS_SECTION_ID)}>See How It Works</Link>
          </div>
          <div className="trust-strip fade delay-3" aria-label="Trust indicators">
            <div className="avatar-stack">
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar count-badge">+</span>
            </div>
            <span className="trust-strip-text">Evidence-led referral workflow</span>
            <span className="trust-divider"></span>
            <span className="live-dot"></span>
            <span className="trust-strip-text">Private by design</span>
          </div>
          <section className="trust-difference fade delay-3" aria-labelledby="trust-difference-title">
            <p id="trust-difference-title" className="trust-difference-title">What makes a RefAI Trust Card different?</p>
            <div className="trust-difference-grid">
              <div className="trust-difference-item"><BadgeCheck aria-hidden="true" /><div><strong>Verified Evidence</strong><span>Skills and claims connect to real resume and project evidence.</span></div></div>
              <div className="trust-difference-item"><Lightbulb aria-hidden="true" /><div><strong>Explainable Intelligence</strong><span>See the factors behind suitability, not an unexplained AI score.</span></div></div>
              <div className="trust-difference-item"><Send aria-hidden="true" /><div><strong>Referral Ready</strong><span>Employees get a quick evidence-backed candidate summary.</span></div></div>
            </div>
          </section>
        </div>

        <div className="mockup-stage fade delay-2" id="trust-card-preview" ref={stageRef}>
          <div className="browser" aria-label="Illustrative RefAI Candidate Trust Card preview" ref={cardRef}>
            <div className="browser-bar">
              <span className="traffic"></span><span className="traffic"></span><span className="traffic"></span>
              <span className="address-text">refai.app / candidate / trust-card</span>
              <span className="analyzing-status">Illustrative preview</span>
            </div>
            <div className="dash">
              <aside className="side">
                <div className="side-title">Workspace</div>
                <div className="side-item active"><span className="tiny-icon"></span> Trust Card</div>
                <div className="side-item"><span className="tiny-icon"></span> Resume Scan</div>
                <div className="side-item"><span className="tiny-icon"></span> Companies</div>
                <div className="side-item"><span className="tiny-icon"></span> Requests</div>
                <div className="side-title" style={{ marginTop: '20px' }}>Signals</div>
                <div className="side-item"><span className="tiny-icon"></span> Skills</div>
                <div className="side-item"><span className="tiny-icon"></span> Projects</div>
              </aside>
              <div className="dash-main">
                <div className="dash-head">
                  <div>
                    <div className="dash-kicker">AI Trust Card · Preview</div>
                    <div className="dash-title">Associate Software Engineer · Atlassian</div>
                    <div className="metric-label" style={{ marginTop: '6px', color: '#8891a0' }}>Ananya Rao · Sample candidate</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="score-pill">Explainable Trust Card</div>
                    <div className="metric-label" style={{ marginTop: '8px', color: '#0e9368' }}>Evidence layout example</div>
                    <div className="demo-score-why" style={{ maxWidth: '230px', textAlign: 'right' }}>Illustrative content — not a live candidate assessment.</div>
                  </div>
                </div>
                <div className="dash-grid">
                  <div className="metric-card">
                    <div className="card-label-mono">Evidence Coverage</div>
                    <div className="score-pill" style={{ marginTop: '9px', display: 'inline-flex' }}>Five-part structure</div>
                    <div className="risk-stats">
                      <div>
                        <span className="risk-stat-label">Score model</span>
                        <span className="risk-stat-value">Five components</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">Resume quality</span>
                  <span className="risk-stat-value">Strong</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">Reviewer</span>
                        <span className="risk-stat-value">Meera</span>
                      </div>
                    </div>
                    <div className="metric-label" style={{ marginTop: '14px' }}>Evidence is reviewed with its source context.</div>
                  </div>
                  <div className="metric-card">
                    <div className="card-label-mono">Skills Found</div>
                    <div className="skills">
                      <span className="skill">React</span>
                      <span className="skill">FastAPI</span>
                      <span className="skill">SQL</span>
                      <span className="skill">Leadership</span>
                    </div>
                    <div className="metric-label" style={{ marginTop: '13px' }}>Evidence shown from the sample resume</div>
                  </div>
                  <div className="readiness">
                    <div className="metric-card">
                      <div className="card-label-mono">Evidence to explore</div>
                      <div className="missing-skill-row" style={{ marginTop: '13px' }}>
                        <div className="missing-skill-line"><span>System Design</span><span className="missing-skill-tag">Add context</span></div>
                      </div>
                      <div className="missing-skill-row" style={{ marginTop: '14px' }}>
                        <div className="missing-skill-line"><span>Deployment work</span><span className="missing-skill-tag">Add evidence</span></div>
                      </div>
                    </div>
                    <div className="summary-card trust-footer">
                      <div className="trust-footer-icon">&#10003;</div>
                      <div>
                        <div className="trust-card-title">Candidate Trust Card</div>
                        <p className="summary-text" style={{ margin: '4px 0 0' }}>A compact view of supporting evidence, open questions, and next steps.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
      <section className="shell logo-marquee-wrap fade delay-3" aria-labelledby="example-company-title">
        <div className="logo-marquee-label-row">
          <span id="example-company-title" className="logo-marquee-label"></span>
          <span className="logo-marquee-line"></span>
        </div>
        <div className="logo-marquee" aria-label="Illustrative company and role examples">
          <div className="logo-marquee-track">
            {renderCompanyMarqueeSet('a')}
            {renderCompanyMarqueeSet('b')}
          </div>
        </div>
        
      </section>
    </section>
  )
}
