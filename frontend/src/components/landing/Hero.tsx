import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDemoMode } from '../../context/DemoModeContext'

const MAX_TILT = 14 // degrees
const MAX_LIFT = 10 // px
const RESET_TRANSFORM = 'perspective(1200px) rotateY(-6deg) rotateX(4deg) translate3d(0,0,0)'

const DEMO_JOURNEY_CONTEXT = ['Target · Atlassian', 'Candidate · Ananya Rao', 'Reviewer · Meera Shah', 'Demo scores · 88 / 91 / 93']

export default function Hero() {
  const { enterDemoMode } = useDemoMode()
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const floaterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const card = cardRef.current
    const floater = floaterRef.current
    if (!stage || !card) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let raf: number | null = null

    const applyTilt = (clientX: number, clientY: number) => {
      const rect = card.getBoundingClientRect()
      const px = (clientX - rect.left) / rect.width // 0 - 1
      const py = (clientY - rect.top) / rect.height // 0 - 1
      const rotateY = (px - 0.5) * MAX_TILT * 2
      const rotateX = (0.5 - py) * MAX_TILT * 2
      const liftX = (px - 0.5) * MAX_LIFT
      const liftY = (py - 0.5) * MAX_LIFT

      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        card.style.transform =
          `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) ` +
          `rotateY(${rotateY.toFixed(2)}deg) translate3d(${liftX.toFixed(1)}px, ${liftY.toFixed(1)}px, 12px)`
        if (floater) {
          floater.style.transform = `translate3d(${(liftX * 0.6).toFixed(1)}px, ${(liftY * 0.6).toFixed(1)}px, 0)`
        }
      })
      card.classList.add('is-tilting')
    }

    const onMouseMove = (e: MouseEvent) => applyTilt(e.clientX, e.clientY)

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) applyTilt(touch.clientX, touch.clientY)
    }

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf)
      card.style.transform = RESET_TRANSFORM
      if (floater) floater.style.transform = 'translate3d(0,0,0)'
      card.classList.remove('is-tilting')
    }

    stage.addEventListener('mousemove', onMouseMove)
    stage.addEventListener('mouseleave', onLeave)
    stage.addEventListener('touchmove', onTouchMove, { passive: true })
    stage.addEventListener('touchend', onLeave)

    return () => {
      stage.removeEventListener('mousemove', onMouseMove)
      stage.removeEventListener('mouseleave', onLeave)
      stage.removeEventListener('touchmove', onTouchMove)
      stage.removeEventListener('touchend', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const renderMarqueeSet = (keyPrefix: string) => (
    <>
      {DEMO_JOURNEY_CONTEXT.map((name, i) => (
        <span key={`${keyPrefix}-${i}`} className="logo-marquee-pair">
          <span className="logo-marquee-item">{name}</span>
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
            <Link className="btn btn-primary" to="/dashboard" onClick={enterDemoMode}>Explore Live Demo</Link>
            <a className="btn btn-secondary" href="#demo">See how it Works!</a>
          </div>
          <div className="trust-strip fade delay-3" aria-label="Trust indicators">
            <div className="avatar-stack">
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar count-badge">Demo</span>
            </div>
            <span className="trust-strip-text">One fictional candidate journey</span>
            <span className="trust-divider"></span>
            <span className="live-dot"></span>
            <span className="trust-strip-text">Demo analysis</span>
          </div>
          <div className="hero-proof-strip fade delay-3" aria-label="RefAI proof metrics">
            <div><strong>88%</strong><span>resume match</span></div>
            <div><strong>91</strong><span>trust score</span></div>
            <div><strong>12</strong><span>sample evidence points</span></div>
          </div>
          <p className="demo-score-why fade delay-3"><strong>Why?</strong> The sample resume matches React, FastAPI, and SQL requirements, supports them with measurable project evidence, and leaves one cloud-certification gap.</p>
        </div>

        <div className="mockup-stage fade delay-2" id="demo" ref={stageRef}>
          <div className="browser" aria-label="RefAI Candidate Trust Card dashboard preview, tilts on hover" ref={cardRef}>
            <div className="browser-bar">
              <span className="traffic"></span><span className="traffic"></span><span className="traffic"></span>
              <span className="address-text">refai.app / candidate / trust-card</span>
              <span className="analyzing-status"><i className="analyzing-dot"></i>Analyzing</span>
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
                    <div className="dash-kicker">AI Trust Card · Demo</div>
                    <div className="dash-title">Associate Software Engineer · Atlassian</div>
                    <div className="metric-label" style={{ marginTop: '6px', color: '#8891a0' }}>Ananya Rao · Demo candidate</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="score-pill">Demo readiness · 91</div>
                    <div className="metric-label" style={{ marginTop: '8px', color: '#0e9368' }}>Resume analyzed · ATS 93</div>
                    <div className="demo-score-why" style={{ maxWidth: '230px', textAlign: 'right' }}><strong>Why?</strong> Clear headings, readable text, and role-specific keywords.</div>
                  </div>
                </div>
                <div className="dash-grid">
                  <div className="metric-card">
                    <div className="card-label-mono">Evidence Coverage</div>
                    <div className="score-pill" style={{ marginTop: '9px', display: 'inline-flex' }}>Strong sample</div>
                    <div className="risk-stats">
                      <div>
                        <span className="risk-stat-label">Resume Match</span>
                        <span className="risk-stat-value">88%</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">ATS Score</span>
                        <span className="risk-stat-value">93</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">Reviewer</span>
                        <span className="risk-stat-value">Meera</span>
                      </div>
                    </div>
                    <div className="risk-bar"><i style={{ width: '18%' }}></i></div>
                    <div className="risk-bar-labels"><span>Strong</span><span>Mixed</span><span>Limited</span></div>
                  </div>
                  <div className="metric-card">
                    <div className="card-label-mono">Skills Found</div>
                    <div className="skills">
                      <span className="skill">React</span>
                      <span className="skill">FastAPI</span>
                      <span className="skill">SQL</span>
                      <span className="skill">Leadership</span>
                    </div>
                    <div className="metric-label" style={{ marginTop: '13px' }}>Resume Match &nbsp;88%</div>
                    <div className="meter" style={{ marginTop: '7px' }}><i style={{ width: '88%', background: '#111827' }}></i></div>
                  </div>
                  <div className="readiness">
                    <div className="metric-card">
                      <div className="card-label-mono">Growth Opportunities</div>
                      <div className="missing-skill-row" style={{ marginTop: '13px' }}>
                        <div className="missing-skill-line"><span>System Design</span><span className="missing-skill-tag">Medium</span></div>
                        <div className="mini-bar amber" style={{ width: '64%' }}></div>
                      </div>
                      <div className="missing-skill-row" style={{ marginTop: '14px' }}>
                        <div className="missing-skill-line"><span>AWS Architecture</span><span className="missing-skill-tag">Low</span></div>
                        <div className="mini-bar amber" style={{ width: '38%' }}></div>
                      </div>
                    </div>
                    <div className="summary-card trust-footer">
                      <div className="trust-footer-icon">&#10003;</div>
                      <div>
                        <div className="trust-card-title">Candidate Trust Card</div>
                        <p className="summary-text" style={{ margin: '4px 0 0' }}>Strong full-stack evidence, measurable project ownership, and clear team leadership.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
      <div className="shell logo-marquee-wrap fade delay-3" aria-label="Fictional demo journey context">
        <div className="logo-marquee-label-row">
          <span className="logo-marquee-label">Fictional demo context · No company affiliation implied</span>
          <span className="logo-marquee-line"></span>
        </div>
        <div className="logo-marquee">
          <div className="logo-marquee-track">
            {renderMarqueeSet('a')}
            {renderMarqueeSet('b')}
          </div>
        </div>
      </div>
    </section>
  )
}
